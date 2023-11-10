console.clear();
window.onload = async () => {
  const parsed = window.location.hash.slice(1).split(":");
  const HostID = parsed[0] || false; // адресса піра до якого потрібно підключитися
  const peer = new Peer({ 
    config: {'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] },
    timeout: 120000 // час в мілісекундах (наприклад, 2 хвилини) 
  });
  const localVideo = document.getElementById('localVideo');
  const hostURL = document.getElementById('hostURL');
  const myURL = `${window.location.protocol}//${window.location.host}${window.location.pathname}`

  if (HostID) {
    peer.on('open', (id) => {

      // Виклик піра A та отримання відеопотоку
      console.log(HostID);
      const call = peer.call(HostID, new MediaStream());
      
      call.on('stream', (stream) => {
        console.log('Received remote stream:', stream);
        console.log('Remote stream state:', stream.active);     
        localVideo.srcObject = null;
        localVideo.srcObject = stream;
      });

      call.on('close', () => {
        console.log('Call closed at:', new Date());
      });;
    })
  } else {
    const stream = await new Promise(function (resolve) {
      navigator.mediaDevices.getUserMedia({ video: true }).then(resolve).catch( e => ( console.error('Error accessing camera', e), resolve(false)))
    })
    console.log(stream);
    if (!stream) return;
        
    peer.on('open', function(id) {
      hostURL.style.visibility = "visible"
      hostURL.onclick = () =>  navigator.clipboard.writeText(`${myURL}#${id}`)
      localVideo.srcObject = stream;
      console.log('My peer ID is: ' + id);
      
      peer.on('call', (call) => {
        console.log("маємо підключення");
        // Відповідь на дзвінок і передача відеопотоку
        call.on('stream', () => 1)
        call.on('close', () => {
          console.log('Call closed at:', new Date());
        });
        console.log(stream);
        call.answer(stream);
      });
    })
  }
}




