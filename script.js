const socket = io();
let localStream, peerConnection, remoteSocketId;
let isCalling = false;
let isMuted = false; // To track mute status
let isCameraOff = false; // To track camera status

// Age Check (18+ Permission)
function allowAccess() {
  document.getElementById("age-check").style.display = "none";
  document.getElementById("main-app").style.display = "block";
}

// Start Call
async function startCall() {
  if (isCalling) return;

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  });

  // Display the local stream's video
  document.getElementById("localVideo").srcObject = localStream;

  peerConnection = new RTCPeerConnection();

  // Add tracks to the peer connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", { to: remoteSocketId, signal: { candidate: event.candidate } });
    }
  };

  socket.emit("find");

  socket.on("match", async (partnerId) => {
    remoteSocketId = partnerId;
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("signal", { to: partnerId, signal: { offer } });
  });

  socket.on("signal", async (data) => {
    if (data.signal.offer) {
      remoteSocketId = data.from;
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("signal", { to: data.from, signal: { answer } });
    } else if (data.signal.answer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
    } else if (data.signal.candidate) {
      await peerConnection.addIceCandidate(data.signal.candidate);
    }
  });

  // Mute local audio so the user doesn't hear their own voice
  muteLocalAudio(localStream);

  // Change the button to "End Call"
  document.getElementById("callButton").innerText = "End Call";
  document.getElementById("callButton").onclick = endCall;

  // Show Mute and Camera buttons
  document.getElementById("controls").style.display = "block";

  isCalling = true;
}

// Mute local audio (so the user doesn't hear their own voice)
function muteLocalAudio(stream) {
  const audioTrack = stream.getAudioTracks()[0]; // Get the first audio track
  if (audioTrack) {
    audioTrack.enabled = false; // Disable the audio so that the local user can't hear themselves
  }
}

// Unmute local audio (to allow remote user to hear)
function unmuteLocalAudio(stream) {
  const audioTrack = stream.getAudioTracks()[0]; // Get the first audio track
  if (audioTrack) {
    audioTrack.enabled = true; // Enable the audio so that the remote user can hear
  }
}

// End Call
function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // Stop all media tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  // Clear the remote video
  const remoteVideo = document.getElementById("remoteVideo");
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }

  // Change the button back to "Start Call"
  document.getElementById("callButton").innerText = "Start Call";
  document.getElementById("callButton").onclick = startCall;

  // Hide Mute and Camera buttons
  document.getElementById("controls").style.display = "none";

  isCalling = false; // Mark the call as ended
}

// Toggle Mute
function toggleMute() {
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    isMuted = !isMuted;
    audioTrack.enabled = !isMuted;
    document.getElementById("muteButton").innerText = isMuted ? "Unmute" : "Mute";
  }
}

// Toggle Camera
function toggleCamera() {
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    isCameraOff = !isCameraOff;
    videoTrack.enabled = !isCameraOff;
    document.getElementById("cameraButton").innerText = isCameraOff ? "Turn Camera On" : "Camera Off";
  }
}

// When unmute is clicked, unmute audio for the remote user to hear
function handleUnmute() {
  // Unmute the local audio so the remote user can hear you
  unmuteLocalAudio(localStream);

  // Change button text to "Mute"
  document.getElementById("muteButton").innerText = "Mute";
}
