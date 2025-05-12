import { Peer } from 'peerjs';
import type * as PeerJS from 'peerjs';
import { customAlphabet } from 'nanoid';
import { html } from './utils';
import { RemoteVideo } from './remote-video';
import { z } from 'zod';


const connectToMsg = z.object({
    type: z.literal('connect-to'),
    connections: z.array(z.string())
});
const chatMsg = z.object({
    type: z.literal('chat'),
    message: z.string(),
});
const messageSchema = z.union([
    connectToMsg,
    chatMsg,
]);


const nanoid = customAlphabet('6789BCDFGHJKLMNPQRTWbcdfghjkmnpqrtwz', 12);

let mediaStream: MediaStream | null = null;
let peer: Peer | null = null;

let connections: PeerJS.DataConnection[] = [];
let mediaConnections: PeerJS.MediaConnection[] = [];

let videoElements: Record<string, RemoteVideo> = {}; // Store video elements by peer ID
const videoContainer = document.getElementById('video-grid') as HTMLDivElement;

const idInput = document.getElementById('username') as HTMLInputElement;
idInput.value = nanoid();

const app = document.getElementById('app') as HTMLDivElement;
const login = document.getElementById('login') as HTMLDivElement;
const user = document.getElementById('user') as HTMLElement;

const localVideo = document.getElementById('local-video') as HTMLVideoElement;


function toast(title: string, message: string, duration: number | false = 3000) {
    const toastContainer = document.getElementById('toast-container') as HTMLDivElement;
    const toast = html`<div class="toast">
    <strong class="toast-title">${title}</strong>
    <p class="toast-message">${message}</p>
    <button class="toast-close" type="button">
        <i class="fa-solid fa-xmark"></i>
        <span class="sr-only">Close</span>
    </button>
</div>`
    const toastTitle = toast.querySelector('.toast-title') as HTMLSpanElement;
    const toastMessage = toast.querySelector('.toast-message') as HTMLParagraphElement;
    const closeButton = toast.querySelector('.toast-close') as HTMLButtonElement;
    const toastDiv = toast.querySelector('.toast') as HTMLDivElement;
    if (!duration) {
        toastDiv.classList.add('toast-noprogress');
    }


    toastTitle.textContent = title;
    toastMessage.textContent = message;
    closeButton.addEventListener('click', () => {
        toastContainer.removeChild(toastDiv);
        if (toastInterval) clearInterval(toastInterval);
    });

    toastContainer.appendChild(toast);

    const startTime = performance.now();
    let toastInterval: number | null = null;
    if (duration) {
        toastInterval = setInterval(() => {
            toastDiv.style.setProperty('--progress', `${(performance.now() - startTime) / duration * 100}%`);
        }, 10);
    }
    
    if (duration && toastInterval) {
        setTimeout(() => {
            if (toastContainer.contains(toastDiv)) {
                toastContainer.removeChild(toastDiv);
            } else {
                console.log('Toast already removed, skipping cleanup.');
            }
            clearInterval(toastInterval);
        }, duration);
    }
    
}

toast('Welcome!', 'You can use this app to connect with other users and share your video and audio streams.', false); // test toast

fixVideoRightClick(localVideo);
function fixVideoRightClick(video: HTMLElement) {
    video.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    video.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            e.preventDefault();
        }
    });
    video.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    });
}


const cleanUp = () => {
    app.hidden = true;
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    // clear video elements
    for (const peerId in videoElements) {
        const remoteVideo = videoElements[peerId];
        remoteVideo.remove();
        delete videoElements[peerId];
    }
    // clear connections
    connections.forEach(c => c.close());
    if (peer) {
        peer.destroy();
        peer = null;
    }
    user.textContent = 'Loading...';
    idInput.value = nanoid();
    login.hidden = false;
};

const start = async () => {
    cleanUp();
    login.hidden = true;
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (error) {
        console.error('Error accessing media devices.', error);
        return;
    }
    localVideo.srcObject = mediaStream;
    peer = new Peer(idInput.value);
    peer.on('open', id => {
        console.log('My peer ID is: ' + id);
        user.textContent = id;
        app.hidden = false;
    });
    peer.on('connection', (dataConnection) => {
        console.log('Incoming connection from ' + dataConnection.peer);
        handleDataConnection(dataConnection);
    });
    peer.on('call', (mediaConnection) => {
        if (!mediaStream) return;
        console.log('Incoming call from ' + mediaConnection.peer);
        mediaConnection.answer(mediaStream); // Answer the call with our stream
        handleMediaConnection(mediaConnection);
    });
    peer.on('error', (err) => {
        console.error('Peer error', err);
        if (err.type === 'peer-unavailable') {
            toast('Error', 'Peer unavailable', 3000);
        } else if (err.type === 'invalid-id') {
            toast('Error', 'Invalid ID', 3000);
        } else if (err.type === 'network') {
            toast('Error', 'Network error', 3000);
        } else if (err.type === 'browser-incompatible') {
            toast('Error', 'Browser incompatible', 3000);
        } else {
            toast('Error', 'Unknown error', 3000);
        }
    });
};

const connectToPeer = (peerId: string) => {
    if (peer && mediaStream) {
        console.log('Connecting to ' + peerId);
        const dataConnection = peer.connect(peerId);
        const mediaConnection = peer.call(peerId, mediaStream);
        handleDataConnection(dataConnection);
        handleMediaConnection(mediaConnection);
    }
}

const handleMediaConnection = (mediaConnection: PeerJS.MediaConnection) => {
    mediaConnections.push(mediaConnection);
    mediaConnection.on('stream', (stream) => {
        console.log('Received stream from ' + mediaConnection.peer);
        if (videoElements[mediaConnection.peer]) return;
        const remoteVideo = new RemoteVideo();
        console.log('Remote video element created', remoteVideo, typeof remoteVideo);
        remoteVideo.setStream(stream);
        videoContainer.appendChild(remoteVideo);
        videoElements[mediaConnection.peer] = remoteVideo;
    });
    mediaConnection.on('close', () => {
        console.log('Media connection closed with ' + mediaConnection.peer);
        const remoteVideo = videoElements[mediaConnection.peer];
        if (remoteVideo) {
            remoteVideo.remove();
            delete videoElements[mediaConnection.peer];
        }
    });
    mediaConnection.on('error', (err) => {
        console.error('Media connection error with ' + mediaConnection.peer, err);
    });
}


const handleDataConnection = (dataConnection: PeerJS.DataConnection) => {
    connections.push(dataConnection);
    dataConnection.on('open', () => {
        console.log('Connected to ' + dataConnection.peer);
        toast('Connected!', `You are now connected to ${dataConnection.peer}.`, 3000);
        dataConnection.send({
            type: 'connect-to',
            connections: connections.map(c => c.peer).filter(c => c !== dataConnection.peer),
        })
    });
    dataConnection.on('data', (data) => {
        console.log('Received data from ' + dataConnection.peer, data);
        const result = messageSchema.safeParse(data);
        if (!result.success) {
            console.error('Invalid message format', result.error);
            return;
        }
        const msg = result.data;
        switch (msg.type) {
            case 'connect-to':
                msg.connections.forEach(connectToPeer);
                break;
            case 'chat':
                toast('Chat Message', msg.message, 3000);
                break;
            default:
                console.error('Unknown message type', msg);
                break;
        }
    });
    dataConnection.on('close', () => {
        console.log('Connection closed with ' + dataConnection.peer);
        const index = connections.findIndex(c => c.peer === dataConnection.peer);
        if (index !== -1) {
            connections.splice(index, 1);
        }
    });
    dataConnection.on('error', (err) => {
        console.error('Connection error with ' + dataConnection.peer, err);
    });
}

const hangUp = () => {
    console.log('Hanging up...');
    connections.forEach(c => c.close());
    mediaConnections.forEach(c => c.close());
    connections = [];
    mediaConnections = [];
    for (const peerId in videoElements) {
        const remoteVideo = videoElements[peerId];
        remoteVideo.remove();
        delete videoElements[peerId];
    }
}

document.getElementById('copy')!.addEventListener('click', async () => {
    console.log('Copying user ID to clipboard...');
    const defaultIcon = document.getElementById('copy-icon') as HTMLSpanElement;
    const success = document.getElementById('copy-success') as HTMLSpanElement;
    const error = document.getElementById('copy-error') as HTMLSpanElement;
    const btn = document.getElementById('copy') as HTMLButtonElement;
    console.log(defaultIcon, success, error);
    btn.disabled = true;
    defaultIcon.classList.add('hidden');
    try {
        await navigator.clipboard.writeText(user.textContent!);
        success.classList.remove('hidden');
        console.log('User ID copied to clipboard!');
        setTimeout(() => {
            console.log('Hiding success message...');
            defaultIcon.classList.remove('hidden');
            success.classList.add('hidden');
            btn.disabled = false;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy!', err);
        error.classList.remove('hidden');
        setTimeout(() => {
            console.log('Hiding error message...');
            error.classList.add('hidden');
            defaultIcon.classList.remove('hidden');
            btn.disabled = false;
        }, 2000);
    }

});

document.getElementById('connect')!.addEventListener('click', start);
document.getElementById('disconnect')!.addEventListener('click', cleanUp);
document.getElementById('hangup')!.addEventListener('click', hangUp);
document.getElementById('call')!.addEventListener('click', () => {
    const peerId = document.getElementById('peer-id') as HTMLInputElement;
    if (peerId.value) {
        connectToPeer(peerId.value);
        peerId.value = '';
    }
});