# @varnxy/ami

Interacting with Asterisk Manager Interface with Node.

## How to use
```js
const AMI = require('@varnxy/ami')

let ami = new AMI({
  port: 5038, // required
  host: 'localhost', // required
  username: 'admin', // required
  password: 'secret', // required
  events: true, // Event mask filter into on or off
  debug: true, // Show all ami event into debug
  keepConnected: true
})

ami.on('error', err => {
  console.log(err)
})

// Show all AMI Response and Event
ami.on('debug', msg => {
  console.log(msg)
})

// AMI Event Cdr
ami.on('Cdr', msg => {
  console.log(msg)
})

ami.on('authenticated', () => {
  // AMI Action SIPpeers
  ami.action('SIPpeers').then(msg => {
    console.log(msg)
  }).catch(err => {
    console.error(err)
  })

  // AMI Action DBGet
  ami.action('DBGet', {
    Family: 'AMPUSER/106',
    Key: 'cidnum'
  }).then(msg => {
    console.log(msg)
  }).catch(err => {
    console.error(err)
  })
})

ami.start()
```
