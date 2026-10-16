// Offline deepfake-safety lessons shown in the Learn tab.
import type React from 'react';
import type { Ionicons } from '@expo/vector-icons';

export interface LessonSection {
  heading: string;
  bullets: string[];
}

export interface Lesson {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  summary: string;
  readMinutes: number;
  sections: LessonSection[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'deepfake-faces',
    icon: 'videocam-outline',
    title: 'Spotting deepfake faces and videos',
    summary: 'The visual clues that give a manipulated face away.',
    readMinutes: 3,
    sections: [
      {
        heading: 'Watch the face',
        bullets: [
          'Blinking can look unnatural: too rare, too regular, or absent altogether.',
          'Lip movements may drift out of sync with the words being said.',
          'Skin can look oddly smooth, plastic or airbrushed, especially around the cheeks and forehead.',
        ],
      },
      {
        heading: 'Check the edges and light',
        bullets: [
          'Look for a blurry or flickering border around the hairline, jaw and ears.',
          'Lighting on the face may not match the scene: shadows pointing the wrong way, or a face that looks "pasted on".',
          'Teeth, eyes and glasses often look distorted or melt when the head turns quickly.',
        ],
      },
      {
        heading: 'When in doubt',
        bullets: [
          'Pause the video and scrub slowly; glitches often appear on fast movement.',
          'If the clip claims something shocking, verify it with a trusted source before believing or sharing it.',
        ],
      },
    ],
  },
  {
    id: 'ai-images',
    icon: 'image-outline',
    title: 'AI-generated images',
    summary: 'Tell-tale artifacts in pictures that were never real.',
    readMinutes: 3,
    sections: [
      {
        heading: 'Zoom into the details',
        bullets: [
          'Hands and fingers are a classic giveaway: extra fingers, fused digits or strange proportions.',
          'Teeth, jewellery, glasses and earrings often look asymmetric or melted.',
          'Text in signs, labels and logos usually comes out garbled or misspelled.',
        ],
      },
      {
        heading: 'Look at the whole scene',
        bullets: [
          'Backgrounds may warp, repeat or blur unnaturally around the subject.',
          'Lighting can be too perfect, and reflections in eyes or mirrors may not match.',
          'Skin, fabric and hair can have an unnaturally smooth or painted texture.',
        ],
      },
      {
        heading: 'Verify the image',
        bullets: [
          'Run a reverse image search to find where the picture first appeared.',
          'Check the source account: when was it created, and does it have a real history?',
        ],
      },
    ],
  },
  {
    id: 'voice-clones',
    icon: 'mic-outline',
    title: 'Voice clones and fake calls',
    summary: 'A familiar voice on the phone can still be fake.',
    readMinutes: 2,
    sections: [
      {
        heading: 'How the scam works',
        bullets: [
          'A short audio sample is enough to clone a voice, and clips from social media are easy to grab.',
          'Scammers add urgency: an accident, an arrest, a bill that must be paid right now.',
          'They ask for something unusual: gift cards, a money transfer or a password.',
        ],
      },
      {
        heading: 'How to stay safe',
        bullets: [
          'Hang up and call the person back on the number you already know.',
          'Agree on a family safe-word for real emergencies.',
          'Ask a question only the real person could answer.',
          'Never act on urgency alone — real emergencies survive a two-minute callback.',
        ],
      },
    ],
  },
  {
    id: 'scams-fraud',
    icon: 'card-outline',
    title: 'Scams and fraud messages',
    summary: 'The pressure patterns behind fake offers and impersonation.',
    readMinutes: 3,
    sections: [
      {
        heading: 'Recognise the pattern',
        bullets: [
          'Too-good-to-be-true offers: prizes you never entered, refunds you did not request.',
          'Payment pressure: deadlines, threats of fines, or "act now before your account closes".',
          'Impersonation of banks, delivery companies or government agencies with fake links.',
        ],
      },
      {
        heading: 'Check before you act',
        bullets: [
          'Do not tap the link — open the official app or type the address yourself.',
          'Look at the sender address or number closely; scammers mimic real names with small changes.',
          'Real organisations never ask for passwords, PINs or one-time codes by message.',
        ],
      },
    ],
  },
  {
    id: 'harmful-content',
    icon: 'flag-outline',
    title: 'Harmful content: what to do',
    summary: 'What to do when you come across abusive or dangerous material.',
    readMinutes: 2,
    sections: [
      {
        heading: 'First steps',
        bullets: [
          'Do not share or forward it, even to warn others — sharing spreads the harm.',
          'Report it in the app where you saw it; most platforms have a report option on every post.',
          'Block or mute the account so it cannot reach you again.',
        ],
      },
      {
        heading: 'Look after yourself and others',
        bullets: [
          'It is normal to feel shaken by disturbing content; talk to someone you trust.',
          'If someone is in immediate danger, contact your local emergency services or a local helpline.',
          'Keep evidence (a screenshot) only if you plan to report it, then delete it.',
        ],
      },
    ],
  },
  {
    id: 'verify-sharing',
    icon: 'checkmark-done-outline',
    title: 'Verify before you share',
    summary: 'A 30-second habit that stops misinformation spreading.',
    readMinutes: 2,
    sections: [
      {
        heading: 'Quick checks',
        bullets: [
          'Check the source: is it a real outlet or an account created last week?',
          'Cross-check: do trusted news sources report the same thing?',
          'Reverse image search reveals whether a photo is old or recycled.',
        ],
      },
      {
        heading: 'Slow down',
        bullets: [
          'Content designed to outrage you is designed to be shared without thinking.',
          'Read past the headline before reacting — captions often mislead.',
          'If you cannot verify it, do not forward it.',
        ],
      },
    ],
  },
];
