# Cloud AI

The cloud provider calls Gemini's REST API directly from `src/ai/gemini.ts`;
it does not use a Gemini SDK. On Android, `expo/fetch` streams the response
using server-sent events. The provider also supports image and audio inline
content.

## API key and model selection

Create a key in Google AI Studio and enter it in **Chat settings**. On Android,
the key is stored with Expo SecureStore. The key is not part of an app backup
or source control. If a key is exposed, revoke it in AI Studio.

The model list is fetched from the account's `generateContent` catalog and
cached for ten minutes. **Auto** selects a tier based on the current user
message: Flash-Lite for short text, Flash for standard or media prompts, and
Pro for complex or long prompts when the key's catalog includes those models.
An individual model can also be selected in Chat settings.

## Automatic fallback

If a request fails with a model-availability, quota, or transient server error,
the provider can try another compatible model in the account's catalog. Model
cooldowns are held in memory for the current app session and keyed by API key
and model family. Retry-After and quota retry details extend the cooldown.
A project-level spend-limit response cools down all model families.

Authentication errors and most invalid requests are reported without cycling
through the model catalog. If streaming has already displayed response tokens,
the provider does not switch models mid-answer, which would combine two
separate responses. Media fallback excludes text-only Gemini-compatible model
families such as cloud Gemma.

## Attachments and offline behavior

Images and recordings are copied to the app's private attachment folder. For
Gemini, the files are read as base64 and sent as inline data with the message.
Local AI uses native local encoders instead. Gemini requests need an internet
connection; chat storage and local inference do not.

## Error handling

- 401/403: check the API key and the model access allowed for that key.
- 429: compatible models are temporarily skipped according to observed quota
  limits; retry after the displayed cooldown.
- 5xx: try another eligible model, then show a short busy message if none work.
- An error before the first streamed token can fall back. Errors after part of
  an answer has already appeared do not mix another answer into the stream.
