const aedes = require('aedes');
const net = require('net');

function createMqttBroker(port) {
  const aedesInstance = aedes();

  const server = net.createServer(aedesInstance.handle);

  server.listen(port, function () {
    console.log(`MQTT Broker (Aedes) đang chạy trên port ${port}`);
  });

  // Sự kiện khi có client (ESP32) kết nối
  aedesInstance.on('client', function (client) {
    console.log(`Client Connected: ${client.id}`);
  });

  // Sự kiện khi client (ESP32) ngắt kết nối
  aedesInstance.on('clientDisconnect', function (client) {
    console.log(`Client Disconnected: ${client.id}`);
  });

  // Sự kiện khi có tin nhắn publish
  aedesInstance.on('publish', function (packet, client) {
    if (client) {
      console.log(`MQTT: Client ${client.id} publish topic ${packet.topic}`);
    }
  });

  return { aedes: aedesInstance, mqttServer: server };
}

module.exports = { createMqttBroker };