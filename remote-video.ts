import { html } from './utils.js';

export class RemoteVideo extends HTMLElement {
    private videoElement: HTMLVideoElement;
    private stream: MediaStream | null = null;

    constructor() {
        super();
        this.appendChild(html`
                <div class="video-container">
                    <video autoplay playsinline disablepictureinpicture></video>
                    <p>Remote Video</p>
                    <div class="flex items-center float-right">
                        <button class="mute">
                            <i class="fa-solid fa-volume-xmark"></i>
                            <span class="sr-only">Mute</span>
                        </button>
                    </div>
                </div>
            `);
        this.videoElement = this.querySelector('video') as HTMLVideoElement;
    }

    setStream(stream: MediaStream) {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.stream = stream;
        this.videoElement.srcObject = stream;
    }

    disconnectedCallback() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }
}

customElements.define('remote-video', RemoteVideo);