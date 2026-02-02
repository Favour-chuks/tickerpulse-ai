// TODO: comeback and look at this 
import { supabase } from "../libs/supabase.js";

supabase.channel('spike_events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'volume_spikes',
    filter: 'processed=eq.false'
  }, async (payload) => {
    await processSpikeEvent(payload.new);
  })
  .subscribe();

async function processSpikeEvent(spike: any) {
  console.log(`Processing spike for ticker ${spike.ticker_id}`);
  
  // STEP 1: Get all the cached data (your original trigger did this)
  const { data: enrichedData } = await supabase.rpc('enrich_spike_data', {
    p_ticker_id: spike.ticker_id,
    p_spike_time: spike.detected_at,
    p_current_price: spike.price_at_spike
  });
  
  // STEP 2: Determine movement type & priority (your logic)
  const analysis = analyzeMovement(spike, enrichedData);
  
  // STEP 3: Check sentiment divergence (async query)
  const divergence = await checkSentimentDivergence(spike.ticker_id);
  
  // STEP 4: Update spike record with enrichment
  await supabase
    .from('volume_spikes')
    .update({
      z_score: analysis.zScore,
      movement_type: analysis.movementType,
      price_at_spike: enrichedData.current_price,
      social_polarity: divergence.socialPolarity,
      filing_uncertainty: divergence.filingUncertainty,
      divergence_score: divergence.score,
      has_catalyst: divergence.hasDivergence,
      catalyst_type: divergence.hasDivergence ? 'sentiment_divergence' : null,
      processed: true
    })
    .eq('id', spike.id);
  
  // STEP 5: Get subscribers (replaces your JOIN query)
  const { data: subscribers } = await supabase
    .from('websocket_subscriptions')
    .select('connection_id, user_id, users(email)')
    .eq('ticker_id', spike.ticker_id)
    .gt('last_ping', new Date(Date.now() - 30000)); // Active in last 30s
  
  // STEP 6: Build alert message (your formatting logic)
  const alertMessage = buildAlertMessage(
    enrichedData.symbol,
    analysis,
    divergence
  );
  
  // STEP 7: Send to connected clients (websocket)
  const deliveryPromises = subscribers?.map(async (sub) => {
    const connection = activeConnections.get(sub.connection_id);
    
    if (connection?.readyState === WebSocket.OPEN) {
      // Send immediately
      connection.send(JSON.stringify({
        type: 'VOLUME_ALERT',
        priority: analysis.priority,
        ticker_id: spike.ticker_id,
        symbol: enrichedData.symbol,
        message: alertMessage,
        metadata: {
          movement_type: analysis.movementType,
          deviation: spike.deviation_multiple,
          has_divergence: divergence.hasDivergence,
          timestamp: spike.detected_at
        }
      }));
      
      return { delivered: true, user_id: sub.user_id };
    } else {
      // Queue for later delivery
      await supabase.from('notification_queue').insert({
        user_id: sub.user_id,
        payload: {
          type: 'VOLUME_ALERT',
          message: alertMessage,
          // ... rest of data
        }
      });
      
      return { delivered: false, user_id: sub.user_id };
    }
  });
  
  await Promise.all(deliveryPromises);
  
  console.log(`Spike ${spike.id} processed, notified ${subscribers?.length} users`);
}


// Helper: Analyze movement (your original logic)
function analyzeMovement(spike: any, data: any) {
  const devMult = spike.deviation_multiple;
  const zScore = data.std_volume > 0 
    ? (spike.volume - data.avg_volume) / data.std_volume 
    : 0;
  
  let movementType: string;
  let priority: string;
  
  if (devMult >= 3.0) {
    movementType = 'SPIKE';
    priority = 'high';
  } else if (devMult <= 0.2) {
    if (spike.price_at_spike > data.ma_20) {
      movementType = 'BEARISH_DRY_UP';
      priority = 'high';
    } else {
      movementType = 'BULLISH_DRY_UP';
      priority = 'medium';
    }
  } else {
    movementType = 'MODERATE_ANOMALY';
    priority = 'medium';
  }
  
  return { movementType, priority, zScore };
}

// Helper: Build alert message (your formatting logic)
function buildAlertMessage(symbol: string, analysis: any, divergence: any) {
  const devMult = analysis.deviation_multiple;
  
  switch (analysis.movementType) {
    case 'SPIKE':
      if (divergence.hasDivergence && analysis.zScore > 3.0) {
        return `🚨 CRITICAL DIVERGENCE: ${symbol} explosive spike (${devMult.toFixed(1)}x) with high uncertainty!`;
      } else if (divergence.hasDivergence) {
        return `⚠️ SENTIMENT DIVERGENCE: ${symbol} spike (${devMult.toFixed(1)}x) conflicts with filing language`;
      } else {
        return `📊 VOLUME SURGE: ${symbol} extreme activity (${devMult.toFixed(1)}x normal)`;
      }
    
    case 'BEARISH_DRY_UP':
      return `📉 BEARISH REGRESSION: ${symbol} volume exhausted at highs (${devMult.toFixed(1)}x normal)`;
    
    case 'BULLISH_DRY_UP':
      return `🛡️ BULLISH REGRESSION: ${symbol} selling exhausted (${devMult.toFixed(1)}x normal)`;
    
    default:
      return `📈 VOLUME ANOMALY: ${symbol} unusual activity detected (${devMult.toFixed(1)}x normal)`;
  }
}

// Helper: Check sentiment divergence (your query)
async function checkSentimentDivergence(tickerId: number) {
  // Get latest SEC filing uncertainty
  const { data: filingData } = await supabase
    .from('social_mentions')
    .select('uncertainty_score')
    .eq('ticker_id', tickerId)
    .eq('source', 'sec_filing')
    .order('published_at', { ascending: false })
    .limit(1)
    .single();
  
  // Get average social sentiment (last 7 days)
  const { data: socialData } = await supabase
    .from('social_mentions')
    .select('polarity_score')
    .eq('ticker_id', tickerId)
    .in('source', ['reddit', 'twitter', 'news'])
    .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .then((res:any) => ({
      data: res.data?.reduce(({sum, row} :{sum: number, row: any}) => sum + row.polarity_score, 0) / (res.data?.length || 1)
    }));
  
  const filingUncertainty = filingData?.uncertainty_score || 0;
  const socialPolarity = socialData || 0;
  const divergenceScore = filingUncertainty * Math.abs(socialPolarity);
  
  return {
    hasDivergence: filingUncertainty > 1.0 && Math.abs(socialPolarity) > 0.3,
    filingUncertainty,
    socialPolarity,
    score: divergenceScore
  };
}