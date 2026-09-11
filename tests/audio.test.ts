import { describe, expect, test, vi } from 'vitest';
import {
  AudioController,
  type AudioPort,
  resolveAudioPath,
  selectFrenchVoice,
  type SpeechPort,
  type SpeechUtterancePort,
} from '../src/lib/audio';
import { makeWord } from './fixtures';

class FakeAudio extends EventTarget implements AudioPort {
  src = '';
  preload = '';
  currentTime = 0;
  pause = vi.fn<() => void>();
  load = vi.fn<() => void>();
  play = vi.fn<() => Promise<void>>(async () => {
    this.dispatchEvent(new Event('playing'));
  });
}

class FakeSpeech implements SpeechPort {
  voices: SpeechSynthesisVoice[] = [];
  cancel = vi.fn<() => void>();
  pause = vi.fn<() => void>();
  resume = vi.fn<() => void>();
  getVoices = vi.fn<() => SpeechSynthesisVoice[]>(() => this.voices);
  speak = vi.fn<(utterance: SpeechUtterancePort) => void>((utterance) => {
    utterance.dispatchEvent(new Event('start'));
  });
}

function makeUtterance(): SpeechUtterancePort {
  return Object.assign(new EventTarget(), {
    lang: '',
    rate: 1,
    voice: null,
    onstart: null,
    onend: null,
    onerror: null,
  }) as unknown as SpeechUtterancePort;
}

describe('audio controller', () => {
  test('resolves root-style paths beneath the deployed base path', () => {
    expect(
      resolveAudioPath(
        '/audio/0001-etre.mp3',
        'https://example.com/lang-1000/',
      ),
    ).toBe('https://example.com/lang-1000/audio/0001-etre.mp3');
  });

  test('reuses one audio element and stops it before a new word', async () => {
    const audio = new FakeAudio();
    const controller = new AudioController(() => audio);
    const first = makeWord(1);
    const second = makeWord(2);

    await controller.toggle(first);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      wordId: '0001',
    });

    await controller.toggle(second);
    expect(audio.pause).toHaveBeenCalledTimes(2);
    expect(audio.currentTime).toBe(0);
    expect(audio.src).toContain('/audio/0002-mot2.mp3');
    expect(controller.getSnapshot().wordId).toBe('0002');
  });

  test('toggles the current word between playing and paused', async () => {
    const audio = new FakeAudio();
    const controller = new AudioController(() => audio);
    const word = makeWord(1);

    await controller.toggle(word);
    await controller.toggle(word);
    expect(controller.getSnapshot().status).toBe('paused');

    await controller.toggle(word);
    expect(controller.getSnapshot().status).toBe('playing');
  });

  test('surfaces a recoverable playback error', async () => {
    const audio = new FakeAudio();
    audio.play.mockRejectedValueOnce(new Error('blocked'));
    const controller = new AudioController(() => audio);

    await controller.toggle(makeWord(1));
    expect(controller.getSnapshot()).toMatchObject({
      status: 'error',
      wordId: '0001',
    });
    expect(controller.getSnapshot().error).toContain('could not be played');
  });

  test('uses one local browser speech controller for runtime pronunciation', async () => {
    const speech = new FakeSpeech();
    const utterances: SpeechUtterancePort[] = [];
    const controller = new AudioController(
      () => new FakeAudio(),
      () => speech,
      () => {
        const utterance = makeUtterance();
        utterances.push(utterance);
        return utterance;
      },
    );
    const word = makeWord(1, {
      audio: {
        path: 'browser-speech:fr-FR',
        provider: 'browser-speech',
        kind: 'neural',
        licenseReference: 'runtime-test',
      },
    });

    await controller.toggle(word);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      wordId: '0001',
    });
    expect(utterances[0]).toMatchObject({ lang: 'fr-FR', rate: 0.95 });

    await controller.toggle(word);
    expect(speech.pause).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().status).toBe('paused');
  });
  test('prefers a neural French voice over the compact platform default', () => {
    const chosen = selectFrenchVoice([
      { name: 'Thomas', lang: 'fr-FR', localService: true },
      { name: 'Grandpa (French (France))', lang: 'fr-FR', localService: true },
      { name: 'Google français', lang: 'fr-FR', localService: false },
      { name: 'Amélie', lang: 'fr-CA', localService: true },
    ]);
    expect(chosen?.name).toBe('Google français');
  });

  test('falls back to a plain fr-FR voice before a novelty one', () => {
    const chosen = selectFrenchVoice([
      { name: 'Rocko (French (France))', lang: 'fr-FR', localService: true },
      { name: 'Audrey', lang: 'fr-FR', localService: true },
    ]);
    expect(chosen?.name).toBe('Audrey');
  });

  test('prefers fr-FR over other French locales at the same quality tier', () => {
    const chosen = selectFrenchVoice([
      { name: 'Chantal', lang: 'fr-CA', localService: true },
      { name: 'Audrey', lang: 'fr-FR', localService: true },
    ]);
    expect(chosen?.name).toBe('Audrey');
  });

  test('ignores voices that are not French at all', () => {
    expect(
      selectFrenchVoice([
        { name: 'Daniel', lang: 'en-GB', localService: true },
      ]),
    ).toBeNull();
  });

  test('speaks the word when the recorded file cannot be played', async () => {
    const audio = new FakeAudio();
    audio.play = vi.fn<() => Promise<void>>(async () => {
      throw new Error('decode failed');
    });
    const speech = new FakeSpeech();
    const utterances: SpeechUtterancePort[] = [];
    const controller = new AudioController(
      () => audio,
      () => speech,
      () => {
        const utterance = makeUtterance();
        utterances.push(utterance);
        return utterance;
      },
    );

    await controller.toggle(makeWord(1));

    expect(utterances).toHaveLength(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      wordId: '0001',
    });
  });
  test('speaks the word when the recorded file fails to decode', async () => {
    const audio = new FakeAudio();
    const speech = new FakeSpeech();
    const utterances: SpeechUtterancePort[] = [];
    const controller = new AudioController(
      () => audio,
      () => speech,
      () => {
        const utterance = makeUtterance();
        utterances.push(utterance);
        return utterance;
      },
    );

    await controller.toggle(makeWord(1));
    audio.dispatchEvent(new Event('error'));

    expect(utterances).toHaveLength(1);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      wordId: '0001',
    });
  });

  test('ignores the error fired when switching words aborts a load', async () => {
    const audio = new FakeAudio();
    const speech = new FakeSpeech();
    const utterances: SpeechUtterancePort[] = [];
    const controller = new AudioController(
      () => audio,
      () => speech,
      () => {
        const utterance = makeUtterance();
        utterances.push(utterance);
        return utterance;
      },
    );

    await controller.toggle(makeWord(1));
    await controller.toggle(makeWord(2));
    // the aborted first load reports its failure after the second one already started
    audio.src = resolveAudioPath('/audio/0001-mot1.mp3');
    audio.dispatchEvent(new Event('error'));

    expect(utterances).toHaveLength(0);
    expect(controller.getSnapshot().wordId).toBe('0002');
  });
  test('plays the recorded sentence rather than the word', async () => {
    const audio = new FakeAudio();
    const controller = new AudioController(() => audio);
    const word = makeWord(1, {
      exampleAudio: {
        path: '/audio/examples/0001.mp3',
        provider: 'piper-neural',
        voiceName: 'fr_FR-siwis-medium',
        licenseReference: 'CC BY 4.0',
      },
    });

    await controller.toggle(word, 'example');
    expect(audio.src).toContain('/audio/examples/0001.mp3');
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      wordId: '0001',
      kind: 'example',
    });
  });

  test('treats the word and its sentence as two separate clips', async () => {
    const audio = new FakeAudio();
    const controller = new AudioController(() => audio);
    const word = makeWord(1, {
      exampleAudio: {
        path: '/audio/examples/0001.mp3',
        provider: 'piper-neural',
        voiceName: 'fr_FR-siwis-medium',
        licenseReference: 'CC BY 4.0',
      },
    });

    await controller.toggle(word, 'word');
    expect(controller.getSnapshot().kind).toBe('word');

    // pressing the sentence while the word plays starts the sentence, it does not
    // read as a second press on the word and pause it
    await controller.toggle(word, 'example');
    expect(controller.getSnapshot()).toMatchObject({
      status: 'playing',
      kind: 'example',
    });
    expect(audio.src).toContain('/audio/examples/0001.mp3');
  });

  test('speaks the sentence when it has no recording yet', async () => {
    const audio = new FakeAudio();
    const speech = new FakeSpeech();
    const utterances: SpeechUtterancePort[] = [];
    const controller = new AudioController(
      () => audio,
      () => speech,
      () => {
        const utterance = makeUtterance();
        utterances.push(utterance);
        return utterance;
      },
    );

    await controller.toggle(makeWord(1), 'example');

    expect(utterances).toHaveLength(1);
    expect(speech.speak).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().kind).toBe('example');
  });
});
