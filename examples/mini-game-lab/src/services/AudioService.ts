/**
 * AudioService - 音频服务
 *
 * 职责：统一管理 BGM 和音效播放，处理音频解锁
 */

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Sound } from '@babylonjs/core/Audio/sound';
import { SoundAssets } from '../assets';

/**
 * 音效类型
 */
export type SfxType = 'coin' | 'harvest' | 'unlock';

/**
 * AudioService 服务
 */
export class AudioService {
  private scene: Scene;

  // Babylon.js Sound 实例
  private bgmSound: Sound | null = null;
  private sfxSounds: Record<SfxType, Sound | null> = {
    coin: null,
    harvest: null,
    unlock: null,
  };

  // HTML Audio 备用方案
  private htmlAudio: {
    bgm: HTMLAudioElement | null;
    coin: HTMLAudioElement | null;
    harvest: HTMLAudioElement | null;
    unlock: HTMLAudioElement | null;
  } | null = null;
  private useHtmlAudio = false;

  // 状态
  private audioUnlocked = false;
  private bgmVolume = 0.35;
  private sfxVolume = 0.6;

  // 音效冷却（防止叠音）
  private sfxLastPlayTime = new Map<string, number>();
  private sfxCooldown = 40; // ms

  constructor(scene: Scene) {
    this.scene = scene;
    this.scene.audioEnabled = true;
  }

  /**
   * 预加载音效
   */
  async preload(): Promise<void> {
    // 检查是否需要使用 HTML Audio（data URL 场景）
    const isDataUrl = SoundAssets.bgm.startsWith('data:');
    if (isDataUrl || !Engine.audioEngine) {
      this.useHtmlAudio = true;
      this.initHtmlAudio();
      return;
    }

    // 使用 Babylon.js Sound
    await this.initBabylonAudio();
  }

  /**
   * 设置音频解锁监听器
   * 需要用户交互才能播放音频
   */
  setupUnlockListener(): void {
    const unlock = () => {
      if (this.audioUnlocked) return;
      this.audioUnlocked = true;


      if (!this.useHtmlAudio && Engine.audioEngine) {
        Engine.audioEngine.unlock();
      }

      this.playBGM();
    };

    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('touchstart', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
  }

  /**
   * 播放音效
   */
  play(sfxType: SfxType): void {
    if (!this.audioUnlocked) return;

    // 冷却检查
    const now = performance.now();
    const lastTime = this.sfxLastPlayTime.get(sfxType) || 0;
    if (now - lastTime < this.sfxCooldown) return;
    this.sfxLastPlayTime.set(sfxType, now);

    if (this.useHtmlAudio) {
      this.playHtmlSfx(sfxType);
    } else {
      this.playBabylonSfx(sfxType);
    }
  }

  /**
   * 播放 BGM
   */
  playBGM(): void {
    if (!this.audioUnlocked) return;

    if (this.useHtmlAudio) {
      if (this.htmlAudio?.bgm) {
        this.htmlAudio.bgm.currentTime = 0;
        void this.htmlAudio.bgm.play();
      }
    } else {
      if (this.bgmSound?.isReady()) {
        this.bgmSound.play();
      }
    }
  }

  /**
   * 停止 BGM
   */
  stopBGM(): void {
    if (this.useHtmlAudio) {
      this.htmlAudio?.bgm?.pause();
    } else {
      this.bgmSound?.stop();
    }
  }

  /**
   * 设置 BGM 音量
   */
  setBGMVolume(volume: number): void {
    this.bgmVolume = volume;
    if (this.useHtmlAudio && this.htmlAudio?.bgm) {
      this.htmlAudio.bgm.volume = volume;
    } else if (this.bgmSound) {
      this.bgmSound.setVolume(volume);
    }
  }

  /**
   * 设置音效音量
   */
  setSfxVolume(volume: number): void {
    this.sfxVolume = volume;
    if (this.useHtmlAudio && this.htmlAudio) {
      if (this.htmlAudio.coin) this.htmlAudio.coin.volume = volume;
      if (this.htmlAudio.harvest) this.htmlAudio.harvest.volume = volume;
      if (this.htmlAudio.unlock) this.htmlAudio.unlock.volume = volume * 1.08; // unlock 稍大
    } else {
      if (this.sfxSounds.coin) this.sfxSounds.coin.setVolume(volume);
      if (this.sfxSounds.harvest) this.sfxSounds.harvest.setVolume(volume);
      if (this.sfxSounds.unlock) this.sfxSounds.unlock.setVolume(volume * 1.08);
    }
  }

  /**
   * 音频是否已解锁
   */
  get isUnlocked(): boolean {
    return this.audioUnlocked;
  }

  /**
   * 清理
   */
  dispose(): void {
    this.bgmSound?.stop();
    this.bgmSound?.dispose();

    for (const sound of Object.values(this.sfxSounds)) {
      sound?.dispose();
    }

    if (this.htmlAudio) {
      this.htmlAudio.bgm?.pause();
      this.htmlAudio.coin?.pause();
      this.htmlAudio.harvest?.pause();
      this.htmlAudio.unlock?.pause();
      this.htmlAudio = null;
    }
  }

  // === 私有方法 ===

  private async initBabylonAudio(): Promise<void> {
    return new Promise((resolve) => {
      let loadedCount = 0;
      const totalCount = 4;

      const onLoaded = () => {
        loadedCount++;
        if (loadedCount >= totalCount) {
          resolve();
        }
      };

      this.bgmSound = new Sound('bgm', SoundAssets.bgm, this.scene, onLoaded, {
        loop: true,
        autoplay: false,
        volume: this.bgmVolume,
      });

      this.sfxSounds.coin = new Sound('sfx_coin', SoundAssets.coin, this.scene, onLoaded, {
        autoplay: false,
        loop: false,
        volume: this.sfxVolume,
      });

      this.sfxSounds.harvest = new Sound('sfx_harvest', SoundAssets.harvest, this.scene, onLoaded, {
        autoplay: false,
        loop: false,
        volume: this.sfxVolume,
      });

      this.sfxSounds.unlock = new Sound('sfx_unlock', SoundAssets.unlock, this.scene, onLoaded, {
        autoplay: false,
        loop: false,
        volume: this.sfxVolume * 1.08,
      });

      // 设置错误处理
      this.attachSoundErrorHandlers();
    });
  }

  private initHtmlAudio(): void {
    const bgm = new Audio(SoundAssets.bgm);
    bgm.loop = true;
    bgm.preload = 'auto';
    bgm.volume = this.bgmVolume;

    const coin = new Audio(SoundAssets.coin);
    coin.preload = 'auto';
    coin.volume = this.sfxVolume;

    const harvest = new Audio(SoundAssets.harvest);
    harvest.preload = 'auto';
    harvest.volume = this.sfxVolume;

    const unlock = new Audio(SoundAssets.unlock);
    unlock.preload = 'auto';
    unlock.volume = this.sfxVolume * 1.08;

    this.htmlAudio = { bgm, coin, harvest, unlock };
  }

  private playBabylonSfx(sfxType: SfxType): void {
    const sound = this.sfxSounds[sfxType];
    if (!sound) return;

    if (sound.isPlaying) {
      sound.stop();
    }

    if (sound.isReady()) {
      sound.play();
    }
  }

  private playHtmlSfx(sfxType: SfxType): void {
    if (!this.htmlAudio) return;

    const audio = this.htmlAudio[sfxType];
    if (audio) {
      audio.currentTime = 0;
      void audio.play();
    }
  }

  private attachSoundErrorHandlers(): void {
    const onError = (_label: string, _error: unknown) => {
      this.useHtmlAudio = true;
      this.initHtmlAudio();
    };

    // 使用类型断言访问 onErrorObservable
    const sounds = [
      { sound: this.bgmSound, label: 'bgm' },
      { sound: this.sfxSounds.coin, label: 'coin' },
      { sound: this.sfxSounds.harvest, label: 'harvest' },
      { sound: this.sfxSounds.unlock, label: 'unlock' },
    ];

    for (const { sound, label } of sounds) {
      const soundAny = sound as unknown as {
        onErrorObservable?: { add: (cb: (e: unknown) => void) => void };
      };
      if (soundAny?.onErrorObservable) {
        soundAny.onErrorObservable.add((error: unknown) => onError(label, error));
      }
    }
  }
}
