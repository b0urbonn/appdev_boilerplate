export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDoc {
  title: string;
  effective: string;
  sections: LegalSection[];
}

const EFFECTIVE = 'October 13, 2026';

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Privacy Policy',
  effective: EFFECTIVE,
  sections: [
    {
      heading: 'Overview',
      body: [
        'This app is built to keep your data on your device. It has no accounts and no servers of its own, and it does not include analytics, ads or tracking.',
      ],
    },
    {
      heading: 'Data stored on your device',
      body: [
        'The text you scan and the AI verdicts are saved in a local database on your phone. Images and voice clips you attach are stored in the app\'s private storage.',
        'Your settings (nickname, theme, AI provider, model choice and system prompt) are saved locally.',
        'Your Gemini API key, if you enter one, is stored encrypted in Android secure storage.',
        'The local AI model file (about 2.6 GB) is saved in the app\'s private storage after you download it.',
        'This data stays on your device until you clear your scans, use "Reset all data", or uninstall the app.',
      ],
    },
    {
      heading: 'Protected-app monitoring',
      body: [
        'If you choose apps to protect, an Accessibility service watches them while they are on screen and captures screenshots and visible text when the screen changes, so the AI can check them for deepfakes, AI-generated and harmful content.',
        'When Cloud AI (Gemini) is selected, these screenshots and screen text are sent to Google to be analysed. When Local AI is selected, analysis stays on your device.',
        'Captured frames are analysed and deleted right away. Only when something is flagged is the screenshot kept, in the app\'s private storage, as part of the detection record. You can delete individual detections or wipe them with "Reset all data".',
      ],
    },
    {
      heading: 'Local AI (Gemma on-device)',
      body: [
        'When you use Local AI, your messages are processed entirely on your device and never leave it.',
      ],
    },
    {
      heading: 'Cloud AI (Google Gemini)',
      body: [
        'When you choose Cloud AI, the text, images or voice clips you submit, the scan history, the system prompt (which includes your nickname if you set one) and your API key are sent over an encrypted connection directly to Google\'s Gemini API to generate a verdict.',
        'Google processes this data under its own terms and privacy policy. Avoid sending sensitive personal information to Cloud AI.',
      ],
    },
    {
      heading: 'Model download',
      body: [
        'Downloading the local model connects to Hugging Face (huggingface.co). As with any download, that service can see your IP address.',
      ],
    },
    {
      heading: 'Backups',
      body: [
        '"Back up data" creates a file with your scans and settings. Your API key, attached images, voice clips and the model file are not included. You choose where the file goes, and anyone who has the file can read your scans.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        'You can clear your scans at any time, reset all data from Settings, or uninstall the app to remove everything it stored.',
      ],
    },
    {
      heading: 'Children',
      body: ['This app is not directed at children under 13.'],
    },
    {
      heading: 'Changes',
      body: [
        'This policy may be updated. The effective date above shows when it last changed.',
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms & Conditions',
  effective: EFFECTIVE,
  sections: [
    {
      heading: 'Acceptance',
      body: ['By using this app you agree to these terms. If you do not agree, do not use the app.'],
    },
    {
      heading: 'The app',
      body: [
        'Maalam is an AI-powered detector for deepfakes and harmful content. It can run the Gemma model on your device, or use Google Gemini with an API key that you provide.',
      ],
    },
    {
      heading: 'AI responses',
      body: [
        'AI verdicts can be wrong, incomplete or inappropriate. A "likely authentic" result does not prove an image is real, and a "harmful" flag is an assessment, not a fact. They are not professional medical, legal, financial or other advice. Check important information yourself before relying on it.',
      ],
    },
    {
      heading: 'Your responsibilities',
      body: [
        'Use the app lawfully and do not use it to create harmful or illegal content.',
        'You are responsible for your Gemini API key, how it is used, and any usage limits or charges from Google.',
        'When you use Cloud AI you must also follow Google\'s Gemini API terms. The local model is subject to the Gemma terms of use.',
      ],
    },
    {
      heading: 'Third-party services',
      body: [
        'Google Gemini and Hugging Face are third-party services with their own terms. We are not responsible for their availability or behaviour.',
      ],
    },
    {
      heading: 'Device resources',
      body: [
        'The local model needs about 2.6 GB of storage and a lot of memory and battery. Downloading it over mobile data may incur charges.',
      ],
    },
    {
      heading: 'Your content',
      body: [
        'Your scans belong to you and are stored only on your device. You are responsible for keeping backups. Data that is deleted or lost cannot be recovered by us.',
      ],
    },
    {
      heading: 'Disclaimer',
      body: [
        'The app is provided "as is", without warranties of any kind. To the extent permitted by law, we are not liable for any damages arising from your use of the app or its AI responses.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'These terms may be updated. The effective date above shows when they last changed. If you keep using the app, you accept the updated terms.',
      ],
    },
  ],
};
