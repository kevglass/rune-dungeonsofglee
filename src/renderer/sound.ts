const audioContext: AudioContext = new AudioContext();
audioContext.resume();

// A lightweight wrapper around a loaded sound
export interface Sound {
    buffer?: AudioBuffer;
    data?: ArrayBuffer;
}

// load a sound from the URL given. This will also attempt to 
// buffer the loaded data into an AudioBuffer
export function loadSound(url: string): Sound {
    const result: Sound = {};

    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "arraybuffer";

    req.onload = () => {
        const arrayBuffer = req.response;
        if (arrayBuffer) {
            result.data = arrayBuffer;
            tryLoadSound(result);
        }
    };

    req.send();
    return result;
}

// Try loading the buffer of data thats been loaded into
// a AudioBuffer
function tryLoadSound(sound: Sound): Promise<void> {
    return new Promise<void>((resolve) => {
        if (sound.buffer) {
            resolve();
        } else {
            if (sound.data && !sound.buffer) {
                audioContext.decodeAudioData(sound.data, (buffer: AudioBuffer) => {
                    sound.buffer = buffer;
                    resolve();
                });
            }
        }
    });
}

// Play a given sound, if the sound has yet to be buffered it will
// be before wee play it
export function playSound(sound: Sound): void {
    tryLoadSound(sound).then(() => {
        if (sound.buffer) {
            const source = audioContext.createBufferSource();
            source.buffer = sound.buffer;
            source.connect(audioContext.destination);
            source.start(0);
        }
    })
}

// Hook to cause the audio context to resume when the user does something. Browsers
// need audio contexts to be resumed on user input events
export function resumeAudioOnInput() {
    audioContext.resume();
}