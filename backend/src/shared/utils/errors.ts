// TODO: woulld need to include more errors that can possibly popup and their responses

const getStatusCodeForError = (code: string): number => {
  const statusMap: Record<string, number> = {
    'INVALID_INPUT': 400,
    'MISSING_TOKEN': 401,
    'INVALID_TOKEN': 401,
    'TOKEN_VERIFICATION_FAILED': 401,
    'LOGIN_FAILED': 401,
    'NO_USER': 401,
    'REGISTRATION_FAILED': 400,
    'REFRESH_FAILED': 401,
    'OAUTH_URL_FAILED': 400,
    'OAUTH_CALLBACK_FAILED': 400,
    'LOGOUT_FAILED': 500,
    'UPDATE_METADATA_FAILED': 400,
  };
  return statusMap[code] || 500;
};


export enum ErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_EXISTS = 'USER_EXISTS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_TOKEN = 'MISSING_TOKEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_VERIFICATION_FAILED = 'TOKEN_VERIFICATION_FAILED',
  LOGIN_FAILED = 'LOGIN_FAILED',
  NO_USER = 'NO_USER',
  REFRESH_FAILED = 'REFRESH_FAILED',
  OAUTH_URL_FAILED = 'OAUTH_URL_FAILED',
  OAUTH_CALLBACK_FAILED = 'OAUTH_CALLBACK_FAILED',
  LOGOUT_FAILED = 'LOGOUT_FAILED',
  UPDATE_METADATA_FAILED = 'UPDATE_METADATA_FAILED',
  UNKNOWN = 'UNKNOWN',
}

const ERROR_CONFIG: Record<ErrorType, ErrorConfig> = {
  [ErrorType.INVALID_CREDENTIALS]: { message: "Invalid email or password.", status: 401 },
  [ErrorType.USER_EXISTS]: { message: "An account with this email already exists.", status: 409 },
  [ErrorType.NETWORK_ERROR]: { message: "Connection issue. Please check your internet.", status: 503 },
  [ErrorType.TOO_MANY_REQUESTS]: { message: "Too many attempts. Please try again later.", status: 429 },
  [ErrorType.WEAK_PASSWORD]: { message: "Password is too weak. Please use a stronger one.", status: 400 },
  [ErrorType.REGISTRATION_FAILED]: { message: "Registration failed. Please try again.", status: 400 },
  [ErrorType.INVALID_INPUT]: { message: "The information provided is invalid.", status: 400 },
  [ErrorType.MISSING_TOKEN]: { message: "Authentication required.", status: 401 },
  [ErrorType.INVALID_TOKEN]: { message: "Session expired. Please log in again.", status: 401 },
  [ErrorType.TOKEN_VERIFICATION_FAILED]: { message: "Identity verification failed.", status: 401 },
  [ErrorType.LOGIN_FAILED]: { message: "Login failed. Please check your credentials.", status: 401 },
  [ErrorType.NO_USER]: { message: "User account not found.", status: 401 },
  [ErrorType.REFRESH_FAILED]: { message: "Session refresh failed. Please log in again.", status: 401 },
  [ErrorType.OAUTH_URL_FAILED]: { message: "Failed to initiate social login.", status: 400 },
  [ErrorType.OAUTH_CALLBACK_FAILED]: { message: "Social login confirmation failed.", status: 400 },
  [ErrorType.LOGOUT_FAILED]: { message: "Logout failed on the server.", status: 500 },
  [ErrorType.UPDATE_METADATA_FAILED]: { message: "Failed to update user profile.", status: 400 },
  [ErrorType.UNKNOWN]: { message: "An unexpected error occurred. Please try again later.", status: 500 },
};

interface ErrorConfig {
  message: string;
  status: number;
}


export class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 400,
    public isPublic: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function handleError(error: any): never {
  const rawMessage = error?.message?.toLowerCase() || "";
  const errorCode = error?.code;
  const status = error?.status || error?.response?.status;

  // 1. Create a logic-based resolver function
  const getErrorType = (): ErrorType => {
    // Priority 1: Direct Code Match (Highest Accuracy)
    if (errorCode && Object.values(ErrorType).includes(errorCode as ErrorType)) {
      return errorCode as ErrorType;
    }

    // Priority 2: Status Code Match
    if (status === 429) return ErrorType.TOO_MANY_REQUESTS;

    // Priority 3: Fuzzy String Matching (Supabase/Third-party)
    const stringMatches: [string, ErrorType][] = [
      ["invalid login credentials", ErrorType.INVALID_CREDENTIALS],
      ["user already registered", ErrorType.USER_EXISTS],
      ["already exists", ErrorType.USER_EXISTS],
      ["password should be", ErrorType.WEAK_PASSWORD],
      ["weak", ErrorType.WEAK_PASSWORD],
      ["network", ErrorType.NETWORK_ERROR],
      ["fetch", ErrorType.NETWORK_ERROR],
      ["token", ErrorType.INVALID_TOKEN],
      ["jwt", ErrorType.INVALID_TOKEN],
      ["oauth", ErrorType.OAUTH_CALLBACK_FAILED],
    ];

    const match = stringMatches.find(([str]) => rawMessage.includes(str));
    return match ? match[1] : ErrorType.UNKNOWN;
  };

  const type = getErrorType();
  const config = ERROR_CONFIG[type];

  // Log everything technical to your server terminal (Securely)
  console.error(`[INTERNAL_DEBUG]:`, {
    type,
    originalMessage: error.message,
    stack: error.stack, // This stays on your server!
  });

  // Return ONLY the clean, user-friendly object
  throw new AppError(config.message, type, config.status);
}