module.exports = {
TMDB_API_KEY: '0ef392bc804230117f062d7d523213bb',
VCAP_SERVICES: JSON.stringify({
  dialog: [{
    credentials: {
      url: 'https://gateway.watsonplatform.net/conversation/api',
      username: '6ebcacc6-8158-4f38-abd7-3b090b4f8157',
      password: 'U0GStCEFy1Dj'
    }
  }],
  natural_language_classifier: [{
    credentials: {
      url: 'https://gateway.watsonplatform.net/natural-language-classifier/api',
      username: '10ca75db-b1cb-40ff-9d8b-28f6da55997e',
      password: 'JtwNRKmkX8Ln'
    }
  }]
})
};