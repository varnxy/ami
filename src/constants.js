module.exports = {
  NEW_LINE: '\r\n',
  END_LINE: '\r\n\r\n',
  COLON_SEP: ': ',
  RECONNECT_BACKOFF: 100,
  MAX_RECONNECT_TIME: 50,
  ENCODING: 'utf-8',
  AMI_PROTO_HEADER: 'Asterisk Call Manager',
  ACTION_RESPONSE_ERROR: 'Error',
  ACTION_LOGIN: 'Login',
  RESPONSE_EVENT_ON: 'on',
  RESPONSE_EVENT_OFF: 'off',
  SIGNAL: {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    DEBUG: 'debug',
    RECONNECTED: 'reconnected',
    ERROR: 'error'
  },
  DEFAULT: {
    port: 5038,
    host: 'localhost',
    username: 'admin',
    secret: '',
    events: false,
    debug: false,
    keepConnected: true
  }
}
