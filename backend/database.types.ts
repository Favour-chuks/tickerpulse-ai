export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alert_cooldowns: {
        Row: {
          alert_count: number | null
          alert_type: string
          last_alert_at: string
          ticker_id: number
        }
        Insert: {
          alert_count?: number | null
          alert_type: string
          last_alert_at: string
          ticker_id: number
        }
        Update: {
          alert_count?: number | null
          alert_type?: string
          last_alert_at?: string
          ticker_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_cooldowns_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_history: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          priority: string | null
          ticker_id: number | null
          users_notified: number | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          priority?: string | null
          ticker_id?: number | null
          users_notified?: number | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          priority?: string | null
          ticker_id?: number | null
          users_notified?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_validation_rules: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          lookback_days: number | null
          rule_logic: Json
          rule_name: string
          rule_type: string
          threshold_value: number | null
          ticker_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          lookback_days?: number | null
          rule_logic: Json
          rule_name: string
          rule_type: string
          threshold_value?: number | null
          ticker_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          lookback_days?: number | null
          rule_logic?: Json
          rule_name?: string
          rule_type?: string
          threshold_value?: number | null
          ticker_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_validation_rules_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_validations: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: number
          is_valid: boolean | null
          rule_id: number | null
          validation_details: Json | null
          volume_spike_id: number
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          is_valid?: boolean | null
          rule_id?: number | null
          validation_details?: Json | null
          volume_spike_id: number
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          is_valid?: boolean | null
          rule_id?: number | null
          validation_details?: Json | null
          volume_spike_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_validations_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_validation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_validations_volume_spike_id_fkey"
            columns: ["volume_spike_id"]
            isOneToOne: false
            referencedRelation: "volume_spikes"
            referencedColumns: ["id"]
          },
        ]
      }
      cached_tech_stats: {
        Row: {
          avg_volume: number | null
          ma_20: number | null
          ma_200: number | null
          ma_50: number | null
          std_volume: number | null
          ticker_id: number
          updated_at: string | null
        }
        Insert: {
          avg_volume?: number | null
          ma_20?: number | null
          ma_200?: number | null
          ma_50?: number | null
          std_volume?: number | null
          ticker_id: number
          updated_at?: string | null
        }
        Update: {
          avg_volume?: number | null
          ma_20?: number | null
          ma_200?: number | null
          ma_50?: number | null
          std_volume?: number | null
          ticker_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cached_tech_stats_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: true
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_narratives: {
        Row: {
          created_at: string | null
          embedding: string | null
          filing_id: number | null
          filing_type: string | null
          guidance: Json | null
          id: number
          key_changes: Json | null
          management_confidence: number | null
          risk_changes: Json | null
          summary: string | null
          ticker_id: number | null
          tone_shift: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          filing_id?: number | null
          filing_type?: string | null
          guidance?: Json | null
          id?: number
          key_changes?: Json | null
          management_confidence?: number | null
          risk_changes?: Json | null
          summary?: string | null
          ticker_id?: number | null
          tone_shift?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          filing_id?: number | null
          filing_type?: string | null
          guidance?: Json | null
          id?: number
          key_changes?: Json | null
          management_confidence?: number | null
          risk_changes?: Json | null
          summary?: string | null
          ticker_id?: number | null
          tone_shift?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_narratives_filing_id_fkey"
            columns: ["filing_id"]
            isOneToOne: false
            referencedRelation: "sec_filings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_narratives_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_promises: {
        Row: {
          created_at: string | null
          expected_fulfillment_date: string | null
          id: number
          made_in_filing_id: number | null
          promise_date: string
          promise_text: string
          status: string | null
          ticker_id: number
          updated_at: string | null
          verification_notes: string | null
          verified_at: string | null
          verified_in_filing_id: number | null
        }
        Insert: {
          created_at?: string | null
          expected_fulfillment_date?: string | null
          id?: number
          made_in_filing_id?: number | null
          promise_date: string
          promise_text: string
          status?: string | null
          ticker_id: number
          updated_at?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_in_filing_id?: number | null
        }
        Update: {
          created_at?: string | null
          expected_fulfillment_date?: string | null
          id?: number
          made_in_filing_id?: number | null
          promise_date?: string
          promise_text?: string
          status?: string | null
          ticker_id?: number
          updated_at?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_in_filing_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_promises_made_in_filing_id_fkey"
            columns: ["made_in_filing_id"]
            isOneToOne: false
            referencedRelation: "sec_filings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_promises_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_promises_verified_in_filing_id_fkey"
            columns: ["verified_in_filing_id"]
            isOneToOne: false
            referencedRelation: "sec_filings"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data: {
        Row: {
          close: number | null
          high: number | null
          low: number | null
          open: number | null
          price: number | null
          ticker_id: number
          time: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id: number
          time: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id?: number
          time?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_data_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data_2026_01: {
        Row: {
          close: number | null
          high: number | null
          low: number | null
          open: number | null
          price: number | null
          ticker_id: number
          time: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id: number
          time: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id?: number
          time?: string
          volume?: number | null
        }
        Relationships: []
      }
      market_data_2026_02: {
        Row: {
          close: number | null
          high: number | null
          low: number | null
          open: number | null
          price: number | null
          ticker_id: number
          time: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id: number
          time: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id?: number
          time?: string
          volume?: number | null
        }
        Relationships: []
      }
      market_data_2026_03: {
        Row: {
          close: number | null
          high: number | null
          low: number | null
          open: number | null
          price: number | null
          ticker_id: number
          time: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id: number
          time: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id?: number
          time?: string
          volume?: number | null
        }
        Relationships: []
      }
      market_data_2026_04: {
        Row: {
          close: number | null
          high: number | null
          low: number | null
          open: number | null
          price: number | null
          ticker_id: number
          time: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id: number
          time: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id?: number
          time?: string
          volume?: number | null
        }
        Relationships: []
      }
      market_data_default: {
        Row: {
          close: number | null
          high: number | null
          low: number | null
          open: number | null
          price: number | null
          ticker_id: number
          time: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id: number
          time: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number | null
          ticker_id?: number
          time?: string
          volume?: number | null
        }
        Relationships: []
      }
      market_data_delivery_stats: {
        Row: {
          delivery_time_ms: number
          subscribers_count: number
          ticker_id: number
          timestamp: string
        }
        Insert: {
          delivery_time_ms: number
          subscribers_count: number
          ticker_id: number
          timestamp: string
        }
        Update: {
          delivery_time_ms?: number
          subscribers_count?: number
          ticker_id?: number
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_data_delivery_stats_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_contradictions: {
        Row: {
          alert_created: boolean | null
          alert_id: number | null
          contradiction_type: string
          created_at: string | null
          detected_at: string | null
          explanation: string
          gemini_confidence: number | null
          id: number
          is_validated: boolean | null
          market_trend_after: string | null
          market_trend_before: string | null
          news_article_id: number | null
          news_headline: string | null
          price_impact: number | null
          quote_1: string | null
          quote_2: string | null
          severity: string
          statement_1_id: number | null
          statement_2_id: number | null
          ticker_id: number
          validation_notes: string | null
          volume_impact: number | null
        }
        Insert: {
          alert_created?: boolean | null
          alert_id?: number | null
          contradiction_type: string
          created_at?: string | null
          detected_at?: string | null
          explanation: string
          gemini_confidence?: number | null
          id?: number
          is_validated?: boolean | null
          market_trend_after?: string | null
          market_trend_before?: string | null
          news_article_id?: number | null
          news_headline?: string | null
          price_impact?: number | null
          quote_1?: string | null
          quote_2?: string | null
          severity: string
          statement_1_id?: number | null
          statement_2_id?: number | null
          ticker_id: number
          validation_notes?: string | null
          volume_impact?: number | null
        }
        Update: {
          alert_created?: boolean | null
          alert_id?: number | null
          contradiction_type?: string
          created_at?: string | null
          detected_at?: string | null
          explanation?: string
          gemini_confidence?: number | null
          id?: number
          is_validated?: boolean | null
          market_trend_after?: string | null
          market_trend_before?: string | null
          news_article_id?: number | null
          news_headline?: string | null
          price_impact?: number | null
          quote_1?: string | null
          quote_2?: string | null
          severity?: string
          statement_1_id?: number | null
          statement_2_id?: number | null
          ticker_id?: number
          validation_notes?: string | null
          volume_impact?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "narrative_contradictions_news_article_id_fkey"
            columns: ["news_article_id"]
            isOneToOne: false
            referencedRelation: "raw_news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_contradictions_statement_1_id_fkey"
            columns: ["statement_1_id"]
            isOneToOne: false
            referencedRelation: "company_narratives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_contradictions_statement_2_id_fkey"
            columns: ["statement_2_id"]
            isOneToOne: false
            referencedRelation: "company_narratives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_contradictions_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      news_sources: {
        Row: {
          created_at: string | null
          fetch_frequency_minutes: number | null
          id: number
          is_active: boolean | null
          last_fetched: string | null
          source_name: string
          source_type: string
          ticker_id: number
        }
        Insert: {
          created_at?: string | null
          fetch_frequency_minutes?: number | null
          id?: number
          is_active?: boolean | null
          last_fetched?: string | null
          source_name: string
          source_type: string
          ticker_id: number
        }
        Update: {
          created_at?: string | null
          fetch_frequency_minutes?: number | null
          id?: number
          is_active?: boolean | null
          last_fetched?: string | null
          source_name?: string
          source_type?: string
          ticker_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "news_sources_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          expires_at: string | null
          id: number
          payload: Json
          priority: string | null
          ticker_id: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          expires_at?: string | null
          id?: number
          payload: Json
          priority?: string | null
          ticker_id?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          expires_at?: string | null
          id?: number
          payload?: Json
          priority?: string | null
          ticker_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_news_articles: {
        Row: {
          analysis_error: string | null
          category: string | null
          created_at: string | null
          gemini_analyzed: boolean | null
          headline: string
          id: number
          image_url: string | null
          published_at: string
          source: string | null
          source_id: string | null
          summary: string | null
          ticker_id: number
          url: string
        }
        Insert: {
          analysis_error?: string | null
          category?: string | null
          created_at?: string | null
          gemini_analyzed?: boolean | null
          headline: string
          id?: number
          image_url?: string | null
          published_at: string
          source?: string | null
          source_id?: string | null
          summary?: string | null
          ticker_id: number
          url: string
        }
        Update: {
          analysis_error?: string | null
          category?: string | null
          created_at?: string | null
          gemini_analyzed?: boolean | null
          headline?: string
          id?: number
          image_url?: string | null
          published_at?: string
          source?: string | null
          source_id?: string | null
          summary?: string | null
          ticker_id?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_news_articles_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      sec_filings: {
        Row: {
          accession_number: string
          cik: string | null
          created_at: string | null
          filed_at: string
          filing_type: string
          id: number
          is_material: boolean | null
          processed: boolean | null
          raw_content: string | null
          ticker_id: number | null
          url: string
        }
        Insert: {
          accession_number: string
          cik?: string | null
          created_at?: string | null
          filed_at: string
          filing_type: string
          id?: number
          is_material?: boolean | null
          processed?: boolean | null
          raw_content?: string | null
          ticker_id?: number | null
          url: string
        }
        Update: {
          accession_number?: string
          cik?: string | null
          created_at?: string | null
          filed_at?: string
          filing_type?: string
          id?: number
          is_material?: boolean | null
          processed?: boolean | null
          raw_content?: string | null
          ticker_id?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sec_filings_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      social_mentions: {
        Row: {
          accession_number: string | null
          author: string | null
          author_followers: number | null
          cik: string | null
          constraining_score: number | null
          created_at: string | null
          engagement_score: number | null
          gemini_analyzed: boolean | null
          gemini_key_themes: string[] | null
          gemini_relevance_score: number | null
          gemini_summary: string | null
          headline: string | null
          id: number
          litigious_score: number | null
          modal_strong_score: number | null
          modal_weak_score: number | null
          polarity_score: number | null
          published_at: string
          sentiment: string | null
          sentiment_detail: Json | null
          sentiment_score: number | null
          source: string
          source_id: string | null
          text: string
          ticker_id: number
          uncertainty_score: number | null
          url: string | null
        }
        Insert: {
          accession_number?: string | null
          author?: string | null
          author_followers?: number | null
          cik?: string | null
          constraining_score?: number | null
          created_at?: string | null
          engagement_score?: number | null
          gemini_analyzed?: boolean | null
          gemini_key_themes?: string[] | null
          gemini_relevance_score?: number | null
          gemini_summary?: string | null
          headline?: string | null
          id?: number
          litigious_score?: number | null
          modal_strong_score?: number | null
          modal_weak_score?: number | null
          polarity_score?: number | null
          published_at: string
          sentiment?: string | null
          sentiment_detail?: Json | null
          sentiment_score?: number | null
          source: string
          source_id?: string | null
          text: string
          ticker_id: number
          uncertainty_score?: number | null
          url?: string | null
        }
        Update: {
          accession_number?: string | null
          author?: string | null
          author_followers?: number | null
          cik?: string | null
          constraining_score?: number | null
          created_at?: string | null
          engagement_score?: number | null
          gemini_analyzed?: boolean | null
          gemini_key_themes?: string[] | null
          gemini_relevance_score?: number | null
          gemini_summary?: string | null
          headline?: string | null
          id?: number
          litigious_score?: number | null
          modal_strong_score?: number | null
          modal_weak_score?: number | null
          polarity_score?: number | null
          published_at?: string
          sentiment?: string | null
          sentiment_detail?: Json | null
          sentiment_score?: number | null
          source?: string
          source_id?: string | null
          text?: string
          ticker_id?: number
          uncertainty_score?: number | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_mentions_accession_number_fkey"
            columns: ["accession_number"]
            isOneToOne: false
            referencedRelation: "sec_filings"
            referencedColumns: ["accession_number"]
          },
          {
            foreignKeyName: "social_mentions_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      ticker_historical_snapshots: {
        Row: {
          avg_sentiment_score: number | null
          close_price: number | null
          created_at: string | null
          high_price: number | null
          id: number
          low_price: number | null
          ma_20: number | null
          ma_200: number | null
          ma_50: number | null
          news_count: number | null
          open_price: number | null
          snapshot_date: string
          social_mention_count: number | null
          ticker_id: number
          trend: string | null
          trend_strength: number | null
          volume: number | null
        }
        Insert: {
          avg_sentiment_score?: number | null
          close_price?: number | null
          created_at?: string | null
          high_price?: number | null
          id?: number
          low_price?: number | null
          ma_20?: number | null
          ma_200?: number | null
          ma_50?: number | null
          news_count?: number | null
          open_price?: number | null
          snapshot_date: string
          social_mention_count?: number | null
          ticker_id: number
          trend?: string | null
          trend_strength?: number | null
          volume?: number | null
        }
        Update: {
          avg_sentiment_score?: number | null
          close_price?: number | null
          created_at?: string | null
          high_price?: number | null
          id?: number
          low_price?: number | null
          ma_20?: number | null
          ma_200?: number | null
          ma_50?: number | null
          news_count?: number | null
          open_price?: number | null
          snapshot_date?: string
          social_mention_count?: number | null
          ticker_id?: number
          trend?: string | null
          trend_strength?: number | null
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticker_historical_snapshots_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      tickers: {
        Row: {
          company_name: string | null
          created_at: string | null
          exchange: string | null
          id: number
          is_active: boolean | null
          sector: string | null
          symbol: string
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          exchange?: string | null
          id?: number
          is_active?: boolean | null
          sector?: string | null
          symbol: string
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          exchange?: string | null
          id?: number
          is_active?: boolean | null
          sector?: string | null
          symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          last_login: string | null
          oauth_id: string | null
          oauth_provider: string | null
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          last_login?: string | null
          oauth_id?: string | null
          oauth_provider?: string | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          last_login?: string | null
          oauth_id?: string | null
          oauth_provider?: string | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      volume_spikes: {
        Row: {
          alert_created: boolean | null
          alert_id: number | null
          alert_severity: string | null
          avg_volume: number | null
          catalyst_source: string | null
          catalyst_type: string | null
          created_at: string | null
          detected_at: string
          deviation_multiple: number
          divergence_score: number | null
          filing_uncertainty: number | null
          gemini_confidence: number | null
          gemini_hypothesis: string | null
          gemini_processed: boolean | null
          gemini_processed_at: string | null
          has_catalyst: boolean | null
          id: number
          movement_type: string | null
          price_at_spike: number | null
          price_change_percent: number | null
          processed: boolean | null
          processed_at: string | null
          social_polarity: number | null
          ticker_id: number
          updated_at: string | null
          validation_reason: string | null
          validation_status: string | null
          volume: number
          z_score: number | null
        }
        Insert: {
          alert_created?: boolean | null
          alert_id?: number | null
          alert_severity?: string | null
          avg_volume?: number | null
          catalyst_source?: string | null
          catalyst_type?: string | null
          created_at?: string | null
          detected_at: string
          deviation_multiple: number
          divergence_score?: number | null
          filing_uncertainty?: number | null
          gemini_confidence?: number | null
          gemini_hypothesis?: string | null
          gemini_processed?: boolean | null
          gemini_processed_at?: string | null
          has_catalyst?: boolean | null
          id?: number
          movement_type?: string | null
          price_at_spike?: number | null
          price_change_percent?: number | null
          processed?: boolean | null
          processed_at?: string | null
          social_polarity?: number | null
          ticker_id: number
          updated_at?: string | null
          validation_reason?: string | null
          validation_status?: string | null
          volume: number
          z_score?: number | null
        }
        Update: {
          alert_created?: boolean | null
          alert_id?: number | null
          alert_severity?: string | null
          avg_volume?: number | null
          catalyst_source?: string | null
          catalyst_type?: string | null
          created_at?: string | null
          detected_at?: string
          deviation_multiple?: number
          divergence_score?: number | null
          filing_uncertainty?: number | null
          gemini_confidence?: number | null
          gemini_hypothesis?: string | null
          gemini_processed?: boolean | null
          gemini_processed_at?: string | null
          has_catalyst?: boolean | null
          id?: number
          movement_type?: string | null
          price_at_spike?: number | null
          price_change_percent?: number | null
          processed?: boolean | null
          processed_at?: string | null
          social_polarity?: number | null
          ticker_id?: number
          updated_at?: string | null
          validation_reason?: string | null
          validation_status?: string | null
          volume?: number
          z_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "volume_spikes_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_items: {
        Row: {
          added_at: string | null
          alert_settings: Json | null
          id: number
          ticker_id: number
          watchlist_id: string
        }
        Insert: {
          added_at?: string | null
          alert_settings?: Json | null
          id?: number
          ticker_id: number
          watchlist_id: string
        }
        Update: {
          added_at?: string | null
          alert_settings?: Json | null
          id?: number
          ticker_id?: number
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      websocket_subscriptions: {
        Row: {
          connection_id: string
          id: string
          last_ping: string | null
          subscribed_at: string | null
          subscription_type: string | null
          ticker_id: number | null
          user_id: string | null
        }
        Insert: {
          connection_id: string
          id?: string
          last_ping?: string | null
          subscribed_at?: string | null
          subscription_type?: string | null
          ticker_id?: number | null
          user_id?: string | null
        }
        Update: {
          connection_id?: string
          id?: string
          last_ping?: string | null
          subscribed_at?: string | null
          subscription_type?: string | null
          ticker_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "websocket_subscriptions_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string
          max_retries: number | null
          news_article_id: number | null
          priority: string | null
          result: Json | null
          retry_count: number | null
          social_mention_id: number | null
          started_at: string | null
          status: string | null
          ticker_id: number | null
          updated_at: string | null
          volume_spike_id: number | null
          worker_name: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          max_retries?: number | null
          news_article_id?: number | null
          priority?: string | null
          result?: Json | null
          retry_count?: number | null
          social_mention_id?: number | null
          started_at?: string | null
          status?: string | null
          ticker_id?: number | null
          updated_at?: string | null
          volume_spike_id?: number | null
          worker_name?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          max_retries?: number | null
          news_article_id?: number | null
          priority?: string | null
          result?: Json | null
          retry_count?: number | null
          social_mention_id?: number | null
          started_at?: string | null
          status?: string | null
          ticker_id?: number | null
          updated_at?: string | null
          volume_spike_id?: number | null
          worker_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_jobs_news_article_id_fkey"
            columns: ["news_article_id"]
            isOneToOne: false
            referencedRelation: "raw_news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_jobs_social_mention_id_fkey"
            columns: ["social_mention_id"]
            isOneToOne: false
            referencedRelation: "social_mentions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_jobs_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_jobs_volume_spike_id_fkey"
            columns: ["volume_spike_id"]
            isOneToOne: false
            referencedRelation: "volume_spikes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      worker_job_stats: {
        Row: {
          avg_processing_time_seconds: number | null
          job_count: number | null
          job_type: string | null
          newest_job: string | null
          oldest_job: string | null
          priority: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_sentiment_divergence: {
        Args: { p_ticker_id: number }
        Returns: {
          divergence_score: number
          filing_uncertainty: number
          has_divergence: boolean
          social_polarity: number
        }[]
      }
      cleanup_expired_notifications: { Args: never; Returns: undefined }
      cleanup_old_jobs: { Args: never; Returns: number }
      cleanup_old_partitions: {
        Args: { p_keep_days?: number }
        Returns: undefined
      }
      create_market_data_partition: {
        Args: { partition_date: string }
        Returns: undefined
      }
      get_pending_jobs: {
        Args: { p_job_type?: string; p_limit?: number }
        Returns: {
          created_at: string
          job_id: string
          job_type: string
          priority: string
          result: Json
          ticker_id: number
          ticker_symbol: string
        }[]
      }
      get_spike_context: {
        Args: { p_ticker_id: number }
        Returns: {
          avg_volume: number
          ma_20: number
          ma_200: number
          ma_50: number
          std_volume: number
          symbol: string
        }[]
      }
      mark_job_completed: {
        Args: { p_job_id: string; p_result?: Json }
        Returns: boolean
      }
      mark_job_failed: {
        Args: { p_error_message: string; p_job_id: string }
        Returns: boolean
      }
      mark_job_processing: {
        Args: { p_job_id: string; p_worker_name: string }
        Returns: boolean
      }
      queue_filing_for_analysis: {
        Args: { p_filing_id: number }
        Returns: string
      }
      queue_spike_for_analysis: {
        Args: { p_spike_id: number }
        Returns: string
      }
      should_throttle_alert: {
        Args: {
          p_alert_type: string
          p_cooldown_minutes?: number
          p_ticker_id: number
        }
        Returns: boolean
      }
      update_cached_tech_stats: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
