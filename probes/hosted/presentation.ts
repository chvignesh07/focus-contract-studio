export type ProbePresentation = {
  message: string;
  tone: 'neutral' | 'pass' | 'fail';
};

export function interpretPlatformObservation(
  value: unknown,
): ProbePresentation {
  if (!isRecord(value)) {
    return invalidObservation();
  }

  const spoof = value.callerSpoofObserved;
  const identity = value.identityHeaderPresent;
  const configured = value.identityProbeConfigured;
  const issued = value.identityMacIssued;
  const repeat = value.repeatIdentityBytesMatch;
  if (
    typeof spoof !== 'boolean' ||
    typeof identity !== 'boolean' ||
    typeof configured !== 'boolean' ||
    typeof issued !== 'boolean' ||
    (repeat !== null && typeof repeat !== 'boolean')
  ) {
    return invalidObservation();
  }

  if (spoof) {
    return {
      message:
        'FAIL — the caller-supplied email header reached the Worker. Do not enable optional identity.',
      tone: 'fail',
    };
  }
  if (!configured) {
    return {
      message:
        'INCONCLUSIVE — the identity comparison key is missing or invalid, so authenticated-email bytes were not signed.',
      tone: 'neutral',
    };
  }
  if (!identity) {
    return {
      message:
        'INCONCLUSIVE — the caller-supplied header was not observed, but no authenticated-email header was present for repeat-byte verification.',
      tone: 'neutral',
    };
  }
  if (!issued) {
    return {
      message:
        'FAIL — authenticated-email bytes were present but no comparison MAC was issued.',
      tone: 'fail',
    };
  }
  if (repeat === null) {
    return {
      message:
        'INCONCLUSIVE — an authenticated-email header was signed, but a second fresh sign-in is required to compare exact bytes.',
      tone: 'neutral',
    };
  }
  if (!repeat) {
    return {
      message:
        'FAIL — exact authenticated-email bytes did not match the prior fresh sign-in. Do not enable optional identity.',
      tone: 'fail',
    };
  }
  return {
    message:
      'PASS — the caller-supplied header was not observed and exact authenticated-email bytes matched the prior fresh sign-in.',
    tone: 'pass',
  };
}

function invalidObservation(): ProbePresentation {
  return {
    message: 'Platform observation returned invalid data.',
    tone: 'fail',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
