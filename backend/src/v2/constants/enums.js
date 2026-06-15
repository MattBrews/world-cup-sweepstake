export const FixtureStatus = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  AWAITING: 'AWAITING',
  LIVE: 'LIVE',
  FT: 'FT',
  COMPLETE: 'COMPLETE',
});

export const EventType = Object.freeze({
  GOAL: 'GOAL',
  BOOKING: 'BOOKING',
  SUB: 'SUB',
  PENALTY_SHOOTOUT: 'PENALTY_SHOOTOUT',
});

export const GoalType = Object.freeze({
  OPEN_PLAY: 'OPEN_PLAY',
  PENALTY: 'PENALTY',
  FREE_KICK: 'FREE_KICK',
  OWN_GOAL: 'OWN_GOAL',
});

export const CardType = Object.freeze({
  YELLOW: 'YELLOW',
  RED: 'RED',
  SECOND_YELLOW: 'SECOND_YELLOW',
});

export const Stage = Object.freeze({
  GROUP_STAGE: 'GROUP_STAGE',
  ROUND_OF_32: 'ROUND_OF_32',
  ROUND_OF_16: 'ROUND_OF_16',
  QUARTER_FINALS: 'QUARTER_FINALS',
  SEMI_FINALS: 'SEMI_FINALS',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL',
});

export const Sport = Object.freeze({
  FOOTBARD: 'football',
});

export const ProviderName = Object.freeze({
  OPENFOOTBALL: 'openfootball',
  FIFA_CALENDAR: 'fifa-calendar',
  FIFA_LIVE: 'fifa-live',
  FIFA_TV: 'fifa-tv',
  MANUAL: 'manual',
});
