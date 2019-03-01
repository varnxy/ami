const AMI = require('../src')
    , path = require('path')

require('dotenv').config({
  path: path.join(__dirname, '.env')
})

let ami = new AMI({
  port: process.env.AMI_PORT, // required
  host: process.env.AMI_HOST, // required
  username: process.env.AMI_USERNAME, // required
  secret: process.env.AMI_SECRET, // required
  events: process.env.AMI_EVENTS === 'true', // Event mask filter into on or off
  debug: process.env.AMI_DEBUG === 'true', // Show all ami event into debug
  keepConnected: process.env.AMI_KEEPCONNECTED === 'true'
})

ami.on('error', err => {
  // console.log(err)
})

ami.once('connected', () => {
  console.log('Connected')
})

ami.on('reconnected', () => {
  console.log('Reconnected')
})

ami.on('disconnected', err => {
  console.log('Disconnected')
})

// Show all AMI Response and Event
ami.on('debug', msg => {
  console.log(msg)
})

// AMI Event Cdr
ami.on('Cdr', msg => {
  console.log(msg)
})

ami.on('PeerlistComplete', msg => {
  // console.log(msg)
})

ami.on('authenticated', () => {
  // AMI Action SIPpeers
  ami.action('SIPpeers').then(msg => {
    // console.log(msg)
  }).catch(console.error)

  // AMI Action DBGet
  ami.action('DBGet', {
    Family: 'AMPUSER/106',
    Key: 'cidnum'
  }).then(msg => {
    // console.log(msg)
  }).catch(console.error)
})

ami.start()
