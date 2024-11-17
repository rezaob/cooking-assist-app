import { Http, File, knownFolders, isAndroid, isIOS } from '@nativescript/core';
import { API_CONFIG } from '../config/api.config';
import { AVAudioPlayerDelegateImpl } from '../delegates/av-audio-player-delegate';

export class VoiceService {
    private apiKey: string;
    private ttsEndpoint = 'https://api.openai.com/v1/audio/speech';
    private isSpeaking: boolean = false;
    private currentPlayer: any = null;
    private audioSession: AVAudioSession;

    constructor() {
        this.apiKey = API_CONFIG.OPENAI_API_KEY;
        if (isIOS) {
            this.audioSession = AVAudioSession.sharedInstance();
            this.setupAudioSession();
        }
    }

    private setupAudioSession() {
        try {
            if (isIOS) {
                this.audioSession.setCategoryWithOptionsError(
                    AVAudioSessionCategoryPlayback,
                    AVAudioSessionCategoryOptions.MixWithOthers
                );
                this.audioSession.setActiveError(true);
            }
        } catch (err) {
            console.error('Audio session setup error:', err);
        }
    }

    async speak(text: string): Promise<void> {
        if (!text || this.isSpeaking) return;

        try {
            this.isSpeaking = true;
            const chunks = this.splitTextIntoChunks(text);
            
            for (const chunk of chunks) {
                const response = await Http.request({
                    url: this.ttsEndpoint,
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    content: JSON.stringify({
                        model: 'tts-1',
                        input: chunk,
                        voice: 'nova',
                        speed: 0.85
                    })
                });

                if (response.statusCode === 200) {
                    const tempFolder = knownFolders.temp();
                    const audioFile = tempFolder.getFile('speech.mp3');
                    
                    if (isIOS) {
                        const audioData = NSData.dataWithData(response.content.toArrayBuffer());
                        audioData.writeToFileAtomically(audioFile.path, true);
                    } else {
                        await audioFile.write(response.content.toArrayBuffer());
                    }

                    await this.playAudio(audioFile.path);
                    await audioFile.remove();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        } catch (error) {
            console.error('Speech error:', error);
            throw error;
        } finally {
            this.isSpeaking = false;
        }
    }

    private async playAudio(filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (isAndroid) {
                    const player = new android.media.MediaPlayer();
                    this.currentPlayer = player;
                    player.setDataSource(filePath);
                    player.prepare();
                    player.setOnCompletionListener(new android.media.MediaPlayer.OnCompletionListener({
                        onCompletion: () => {
                            player.release();
                            this.currentPlayer = null;
                            resolve();
                        }
                    }));
                    player.start();
                } else if (isIOS) {
                    const url = NSURL.fileURLWithPath(filePath);
                    const player = AVAudioPlayer.alloc().initWithContentsOfURLError(url);
                    
                    if (player) {
                        this.currentPlayer = player;
                        const delegate = AVAudioPlayerDelegateImpl.initWithResolve(() => {
                            this.currentPlayer = null;
                            resolve();
                        });
                        player.delegate = delegate;
                        player.play();
                    } else {
                        reject(new Error('Failed to initialize audio player'));
                    }
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    private splitTextIntoChunks(text: string, maxLength: number = 150): string[] {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const chunks: string[] = [];
        let currentChunk = '';

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxLength) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            currentChunk += sentence + ' ';
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    async stop(): Promise<void> {
        this.isSpeaking = false;
        if (this.currentPlayer) {
            if (isAndroid) {
                this.currentPlayer.stop();
                this.currentPlayer.release();
            } else if (isIOS) {
                this.currentPlayer.stop();
            }
            this.currentPlayer = null;
        }
    }
}