import bundledCredits from '../data/audio-credits.json';
import stickerManifest from '../data/stickers.json';
import type { AudioCredits as AudioCreditsData } from '../types';

type AudioCreditsProps = {
  credits?: AudioCreditsData;
  languageName?: string;
  description?: string;
};

const providerLabels: Record<string, string> = {
  'wikimedia-commons': 'Native speaker recordings from Wikimedia Commons',
  'piper-neural': 'Offline neural synthesis',
  'google-cloud-tts': 'Google Cloud neural synthesis',
  forvo: 'Forvo recordings',
  'browser-speech': 'Your browser’s built-in speech engine',
};

export function AudioCredits({
  credits = bundledCredits as AudioCreditsData,
  languageName = 'French',
  description,
}: AudioCreditsProps) {
  const namedSpeakers = credits.speakers;
  const artwork = (stickerManifest.stickers ?? []) as {
    id: string;
    title: string;
    license: string;
    sourceUrl: string;
  }[];

  return (
    <details className="audio-credits">
      <summary>Credits and licences</summary>
      <div className="audio-credits-body">
        <p>
          {description ??
            (languageName === 'French'
              ? 'Pronunciations are recordings of native French speakers, shared through Wikimedia Commons and the Lingua Libre project. They are used here under the licences below, which require attribution.'
              : 'Pronunciations are synthesized via high-fidelity neural speech engines and open voice models configured for Spanish. Recordings and artwork are used under the licences below.')}
        </p>

        <h3>Sources</h3>
        <ul className="credit-list">
          {credits.providers.map((provider) => (
            <li key={provider.provider}>
              <span>
                {providerLabels[provider.provider] ?? provider.provider}
              </span>
              <span className="credit-count">
                {provider.recordings}{' '}
                {provider.recordings === 1 ? 'recording' : 'recordings'}
              </span>
            </li>
          ))}
        </ul>

        <h3>Licences</h3>
        <ul className="credit-list">
          {credits.licenses.map((license) => (
            <li key={license.name}>
              {license.url ? (
                <a href={license.url} rel="license noreferrer" target="_blank">
                  {license.name}
                </a>
              ) : (
                <span>{license.name}</span>
              )}
              <span className="credit-count">
                {license.recordings}{' '}
                {license.recordings === 1 ? 'recording' : 'recordings'}
              </span>
            </li>
          ))}
        </ul>

        {namedSpeakers.length > 0 && (
          <>
            <h3>Speakers</h3>
            <ul className="credit-list speaker-list">
              {namedSpeakers.map((speaker) => (
                <li key={speaker.speaker}>
                  {speaker.profileUrl ? (
                    <a
                      href={speaker.profileUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {speaker.speaker}
                    </a>
                  ) : (
                    <span>{speaker.speaker}</span>
                  )}
                  <span className="credit-count">{speaker.recordings}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {artwork.length > 0 && (
          <>
            <h3>Artwork</h3>
            <p className="credit-note">
              The paper scraps are scanned plates, prints and stamps from the
              public domain, cut off their pages for this site.
            </p>
            <ul className="credit-list speaker-list">
              {artwork.map((piece) => (
                <li key={piece.id}>
                  <a href={piece.sourceUrl} rel="noreferrer" target="_blank">
                    {piece.title}
                  </a>
                  <span className="credit-count">{piece.license}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {credits.synthesizedVoices.length > 0 && (
          <>
            <h3>Synthesized voices</h3>
            <ul className="credit-list">
              {credits.synthesizedVoices.map((voice) => (
                <li key={voice.voiceName}>
                  <span>{voice.voiceName}</span>
                  <span className="credit-count">
                    {voice.recordings}{' '}
                    {voice.recordings === 1 ? 'recording' : 'recordings'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
