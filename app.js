console.clear();
window.onload = async () => {
  const parsed = window.location.hash.slice(1).split(":");
  const HostID = parsed[0] || false; // адресса піра до якого потрібно підключитися
  const peer = new Peer();
  const localVideo = document.getElementById('localVideo');
  const hostURL = document.getElementById('hostURL');
  const myURL = `${window.location.protocol}//${window.location.host}${window.location.pathname}`

  if (HostID) {
    const dataConnection  = peer.connect(HostID)
    
    dataConnection.on('open', () => {
      console.log('Connected to host');
    });
    
    dataConnection.on('data', (data) => {
      // Отримано дані від хоста (це може бути відео)
      console.log('Received data:', data);
      // Обробка отриманих даних
      const blob = new Blob([data], { type: 'video/webm' });
      localVideo.src = window.URL.createObjectURL(blob);
    });

  } else {
    // Запит на доступ до камери
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(function handleSuccess(stream) {
      
      peer.on('open', function(id) {
        // hostURL.href = `${myURL}#${id}`
        // hostURL.innerText = `${myURL}#${id}`
        // hostURL.onclick = () => (window.open(`${myURL}#${id}`,'name','width=393,height=851'), false)
        hostURL.onclick = () =>  navigator.clipboard.writeText(`${myURL}#${id}`)
        
        console.log('My peer ID is: ' + id);
      })

      localVideo.srcObject = stream;
      
      // Відправляємо стрім через PeerJS
      peer.on('connection', (dataConnection) => {

        dataConnection.on('open', function () {
          const chunks = [];

          // Кожен раз, коли отримуємо кадр відео, відправляємо його
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = function (event) {
            if (event.data.size > 0) {
              chunks.push(event.data);
              console.log("sent chunks: ", event.data);
              dataConnection.send(event.data);
            }
          };

          mediaRecorder.start();

        })
      })

    })
    .catch(function (error) {
      console.error('Error accessing camera:', error);
    });
  }
}




