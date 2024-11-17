export class AVAudioPlayerDelegateImpl extends NSObject implements AVAudioPlayerDelegate {
    private resolve: () => void;

    public static ObjCProtocols = [AVAudioPlayerDelegate];

    static initWithResolve(resolve: () => void): AVAudioPlayerDelegateImpl {
        const delegate = <AVAudioPlayerDelegateImpl>AVAudioPlayerDelegateImpl.new();
        delegate.resolve = resolve;
        return delegate;
    }

    audioPlayerDidFinishPlayingSuccessfully(player: AVAudioPlayer, flag: boolean) {
        player.delegate = null;
        this.resolve();
    }
}