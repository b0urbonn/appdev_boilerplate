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
        'Your chat messages are saved in a local database on your phone. Images and voice messages you attach are stored in the app\'s private storage.',
        'Your settings (nickname, theme, AI provider, model choice and system prompt) are saved locally.',
        'Your Gemini API key, if you enter one, is stored encrypted in Android secure storage.',
        'The local AI model file (about 2.6 GB) is saved in the app\'s private storage after you download it.',
        'This data stays on your device until you clear the chat, use "Reset all data", or uninstall the app.',
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
        'When you choose Cloud AI, your messages, any images or voice messages you attach, the chat history, the system prompt (which includes your nickname if you set one) and your API key are sent over an encrypted connection directly to Google\'s Gemini API to generate a reply.',
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
        '"Back up data" creates a file with your chat and settings. Your API key, attached images, voice messages and the model file are not included. You choose where the file goes, and anyone who has the file can read your chat.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        'You can clear the chat at any time, reset all data from Settings, or uninstall the app to remove everything it stored.',
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
        'The app is an AI chat assistant. It can run the Gemma model on your device, or use Google Gemini with an API key that you provide.',
      ],
    },
    {
      heading: 'AI responses',
      body: [
        'AI responses can be wrong, incomplete or inappropriate. They are not professional medical, legal, financial or other advice. Check important information yourself before relying on it.',
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
        'Your chats belong to you and are stored only on your device. You are responsible for keeping backups. Data that is deleted or lost cannot be recovered by us.',
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
