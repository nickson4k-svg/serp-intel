const proxyHandler = require('./proxy.js');

module.exports = (req, res) => {
  return proxyHandler(req, res);
};
