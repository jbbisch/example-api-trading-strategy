// Tasks for project


//login and authorization
// Create login and authorization
const Tradovate = require('example-api-trading-strategy');
const tradovate = new Tradovate({
    apiKey: 'apiKey',
    username: 'username',
    password: 'password',
});


async function runBot() {
    await tradovate.login();
    const account = await tradovate.getAccount();
    console.log(account);
    await tradovate.logout();
}

runBot();
// Stretegy Logic (crossover moving average)

// Functions to buy or sell

// Functions to get data from API

// Function for time intevals between data collection

