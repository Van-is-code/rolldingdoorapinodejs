const aedes = require('aedes');
const net = require('net'); // Dùng net cho TCP MQTT

function createMqttBroker(port = 1883) { // Port mặc định 1883
  const aedesInstance = aedes();

  // Tạo server TCP lắng nghe trên port được chỉ định
  const server = net.createServer(aedesInstance.handle);

  server.listen(port, function () {
    console.log(`MQTT Broker (Aedes) đang chạy trên port TCP ${port}`);
  });

  server.on('error', (err) => {
     console.error(`MQTT Broker Lỗi Server: ${err.message}`);
     // Cân nhắc việc đóng server hoặc thử khởi động lại
  });


  // --- Các sự kiện log của Aedes ---
  aedesInstance.on('client', function (client) {
    console.log(`MQTT Client Connected: ${client.id}`);
  });

  aedesInstance.on('clientDisconnect', function (client) {
    console.log(`MQTT Client Disconnected: ${client.id}`);
  });

   aedesInstance.on('clientError', function (client, err) {
    console.error(`MQTT Client Error (${client ? client.id : 'N/A'}): ${err.message}`);
  });


  aedesInstance.on('subscribe', function (subscriptions, client) {
    console.log(`MQTT Client ${client ? client.id : 'N/A'} subscribed to: ${subscriptions.map(s => s.topic).join(', ')}`);
  });

  aedesInstance.on('unsubscribe', function (subscriptions, client) {
     console.log(`MQTT Client ${client ? client.id : 'N/A'} unsubscribed from: ${subscriptions.join(', ')}`);
  });

  aedesInstance.on('publish', function (packet, client) {
    // Chỉ log nếu packet không phải là PUBACK, PUBREC,... (các packet hệ thống)
    // Và không phải là publish từ chính server (client is null)
    if (client && packet.cmd === 'publish') {
       try {
           console.log(`MQTT Client ${client.id} publish topic [${packet.topic}] - Payload: ${packet.payload.toString()}`);
       } catch (e) {
            console.log(`MQTT Client ${client.id} publish topic [${packet.topic}] - Payload: <Binary Data>`);
       }

    }
  });

  // Sự kiện quan trọng: Khi broker từ chối kết nối client (ví dụ trùng ID)
   aedesInstance.authenticate = (client, username, password, callback) => {
    // Logic xác thực đơn giản hoặc phức tạp có thể thêm ở đây
    // Hiện tại cho phép mọi kết nối (callback(null, true))
    // Nếu callback(err) -> lỗi, callback(null, false) -> từ chối
    // console.log(`MQTT Authenticating client: ${client.id}, user: ${username}`);
    callback(null, true);
  };

  aedesInstance.on('connectionError', (client, err) => {
      console.error(`MQTT Connection Error (${client ? client.id : 'N/A'}): ${err.message}`);
      // Lỗi rc=-2 thường sẽ được ghi nhận ở đây hoặc clientError
      if (err.message.includes('duplicate client')) {
         console.warn(`>>>> Lỗi kết nối MQTT: Client ID bị trùng lặp: ${client ? client.id : 'N/A'}`);
      }
  });


  return { aedes: aedesInstance, mqttServer: server };
}

module.exports = { createMqttBroker };