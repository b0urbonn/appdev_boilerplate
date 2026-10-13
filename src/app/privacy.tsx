import React from 'react';
import { LegalDocView } from '@/components/LegalDocView';
import { PRIVACY_POLICY } from '@/legal/content';

export default function PrivacyScreen() {
  return <LegalDocView doc={PRIVACY_POLICY} />;
}
