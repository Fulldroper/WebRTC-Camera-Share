window.onload = async () => {
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('2d');
  const start = document.querySelector(".start")
  let scanningInterval = null;
  let isHost = -1;

  // prevent download camera image
  canvas.oncontextmenu = e => e.preventDefault();

  // Automatically scale canvas to fit the window size
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }  

  resizeCanvas(); // Initial sizing setup

  // Getting a list of servers
  let iceServers = await fetch("https://fulldroper.metered.live/api/v1/turn/credentials?apiKey=20b057434f2dba67cce42dbf43a66658ba5d")
    .then(r => r.json());
  
  if (!iceServers || iceServers.error) console.error("TURN сервер недоступний");

  // Creating a peer
  const peer = new Peer({
    config: { iceServers },
    timeout: 120000
  });

  // Creating QR Code with peer ID
  function createQRCode(id) {
    const opts = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.3,
      margin: 1,
      width: 200,
      color: {
        dark:"#000",
        light:"#FFF"
      }
    }
    QRCode.toCanvas(canvas, id, opts, function (error) {
      if (error) console.error(error);
      else console.debug('QR-код створено успішно!');
    });
  }

  // QR code scanning function
  function scanQRCode() {
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

    if (qrCode) {
      // If the QR code is found, stop scanning
      clearInterval(scanningInterval);
      scanningInterval = null;

      // Відображаємо результат
      console.debug("QR-код знайдено:", qrCode.data);

      // Display the result
      const qrDetectedEvent = new CustomEvent("qrDetected", {
        detail: { data: qrCode.data },
      });
      document.dispatchEvent(qrDetectedEvent); // Generate an event
    } else {
      console.log("QR-код не знайдено. Сканування продовжується...");
    }
  }

  // Function to start the scan cycle
  function startScanning() {
    if (scanningInterval) {
      return; // Avoid duplicate scans
    }
    console.debug("Сканування...")
    scanningInterval = setInterval(scanQRCode, 200); // Scanning every second
  }

  // Function of creating an empty media stream (audio + video)
  const createFakeMediaStream = (opt = {}) => {
    const { videoWidth = 640, videoHeight = 480 } = opt
    const _a = new MediaStream();

    const _c = document.createElement('canvas');
    _c.width = videoWidth;
    _c.height = videoHeight;

    // Draw an empty image on the canvas
    const _d = _c.getContext('2d');
    _d.fillRect(0, 0, videoWidth, videoHeight); // Fill the canvas with black or another color

    // Capture a stream from canvas
    const _e = _c.captureStream().getVideoTracks()[0];
    _e.enabled = false; // Turn off the video track
    _a.addTrack(_e);
    
    return _a;
  };

  // Starting a webcam
  async function startWebcam() {
    try {
      // Create a video element (without adding to the DOM)
      const video = document.createElement('video');
      video.srcObject = streamController.stream;
      video.autoplay = true;
      video.playsInline = true;

      // Setting up video rendering on canvas
      function drawFrame() {
        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = canvas.width / canvas.height;

        let drawWidth, drawHeight;

        if (canvasRatio > videoRatio) {
          // Height restrictions
          drawHeight = canvas.height;
          drawWidth = drawHeight * videoRatio;
        } else {
          // Width restrictions
          drawWidth = canvas.width;
          drawHeight = drawWidth / videoRatio;
        }

        // Centering
        const xOffset = (canvas.width - drawWidth) / 2;
        const yOffset = (canvas.height - drawHeight) / 2;

        context.clearRect(0, 0, canvas.width, canvas.height); // Clean up the canvas
        context.drawImage(video, xOffset, yOffset, drawWidth, drawHeight); // render video
        requestAnimationFrame(drawFrame); // update frame
      }

      video.addEventListener('loadedmetadata', () => {
        resizeCanvas(); // Set the initial canvas size
        drawFrame(); // Start rendering
      });

    } catch (err) {
      console.error('Помилка доступу до вебкамери:', err);
    }
  }

  peer.on("open", async (id) => {
    createQRCode(id)

    start.onclick = async () => {
      // skip if already setup conection role
      if (isHost !== -1) return;
      // set as host
      isHost = 1

      // hide tools
      // start.querySelector("h2").innerText = "Change Camera";
      // start.onclick = async function () {
      //   await streamController.getVideoDevices()
      //   await streamController.switchCamera()
      // };
      start.style.display = "none";

      // change canvas style
      canvas.style.width = "auto";
      canvas.style.height = "auto";
      
      // receiving a camera
      streamController.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });

      // Adaptability
      window.addEventListener('resize', resizeCanvas);

      // start scanning qrcode
      startScanning()

      // Handler for a custom event “qrDetected”
      document.addEventListener("qrDetected", async function(event) {
        console.debug("QR-код виявлено:", event.detail.data);

        // Host (viewer call)
        const c = await peer.call(event.detail.data, streamController.stream);
        console.debug("calling to", event.detail.data)
        
        if (!c) return console.error("Не вдалося ініціювати виклик. Перевірте ID хоста.");
        c.on("error", e => console.error("Помилка виклику:", e));
      });          
    };

    peer.on("call", c => {
      // skip if already setup conection role
      if (isHost !== -1) return;
      // set as client
      isHost = 0

      console.debug("resive call")

      // hide tools
      start.style.display = "none";

      // change canvas style
      canvas.style.width = "auto";
      canvas.style.height = "auto";

      // answer to call
      c.answer(createFakeMediaStream());

      // Adaptability
      window.addEventListener('resize', resizeCanvas);

      c.on("stream", s => streamController.stream = s);
      c.on("error", e => console.error("Помилка виклику:", e));
    
    });
  });

  peer.on("error", e => console.error("Помилка Peer.js:", e));



let streamController = {
  _stream: null, // приватне значення
  _currentCameraIndex: 1,
  _videoDevices: [],

  // Геттер
  get stream() {
    return this._stream;
  },

  get videoDevices() {
    return this._videoDevices;
  },

  // Сеттер
  set stream(value) {
    // this._stream?.getTracks().forEach(track => track.stop())
    this._stream = value;
    // Запуск стріму
    startWebcam();
  },

  // Функція для отримання доступних камер
  async getVideoDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    this._videoDevices = devices.filter(device => device.kind === "videoinput");
    console.log(this._videoDevices);
    
    return this._videoDevices;
  },

  // Функція для запуску камери
  async switchCamera() {
    try {
      // Отримуємо потік з новою камерою
      const constraints = {
        video: { deviceId: { exact: this._videoDevices[this._currentCameraIndex].deviceId } },
      };

      const Nstream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this._stream) {
        const Otrack = this._stream.getVideoTracks()[0]
        this._stream.removeTrack(Otrack)
        const Ntrack = Nstream.getVideoTracks()[0]
        this._stream.addTrack(Ntrack)
      } else {
        this._stream = Nstream
      }
      
      // Оновлюємо індекс камери для наступного переключення
      this._currentCameraIndex = (this._currentCameraIndex + 1) % this._videoDevices.length;
    } catch (error) {
      console.error("Помилка при перемиканні камери:", error);
    }
  }
};

};
