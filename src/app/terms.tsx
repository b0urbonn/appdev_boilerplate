import React from 'react';
import { LegalDocView } from '@/components/LegalDocView';
import { TERMS } from '@/legal/content';

export default function TermsScreen() {
  return <LegalDocView doc={TERMS} />;
}
