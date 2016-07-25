module.exports = {
TMDB_API_KEY: '0ef392bc804230117f062d7d523213bb',
VCAP_SERVICES: JSON.stringify({
  dialog: [{
    credentials: {
      url: 'https://gateway.watsonplatform.net/dialog/api',
      username: '9e350cfb-945f-4324-9475-26760a08da96',
      password: 'CpcTRlTK6BMC'
    }
  }],
  natural_language_classifier: [{
    credentials: {
      url: 'https://gateway.watsonplatform.net/natural-language-classifier/api',
      username: '05414a87-2d8b-49ca-a972-0ae62999f23f',
      password: '2cH3whWtxENv'
    }
  }]
})
};