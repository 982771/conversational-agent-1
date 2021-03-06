/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express  = require('express'),
  app        = express(),
  extend     = require('util')._extend,
  pkg        = require('./package.json'),
  training   = require('./training/setup'),
  Q          = require('q');


// Bootstrap application settings
require('./config/express')(app);

var PROMPT_MOVIE_SELECTED = 'USER CLICKS BOX';
var PROMPT_MOVIES_RETURNED = 'UPDATE NUM_MOVIES';
var PROMPT_CURRENT_INDEX = 'UPDATE CURRENT_INDEX';
var log = console.log.bind(null, '  ');

var apis = null;

// promises
var converse, updateProfile, getIntent, searchMovies, getMovieInformation, searchActorId, searchMovieDetails = null;

// train the service and create the promises with the result
training.train(function(err) {
	if (err){
    log('ERROR:', err.error);
  }

  apis = require('./api/services');

  converse = Q.nfbind(apis.dialog.conversation.bind(apis.dialog));
  updateProfile = Q.nfbind(apis.dialog.updateProfile.bind(apis.dialog));
  getIntent = Q.nfbind(apis.classifier.classify.bind(apis.classifier));
  searchMovies = Q.nfbind(apis.movieDB.searchMovies.bind(apis.movieDB));
  searchActorId = Q.nfbind(apis.movieDB.searchActorId.bind(apis.movieDB));  
  searchMovieDetails = Q.nfbind(apis.movieDB.searchMovieDetails.bind(apis.movieDB));
  getMovieInformation = Q.nfbind(apis.movieDB.getMovieInformation.bind(apis.movieDB));
});

// create the conversation
app.post('/api/create_conversation', function(req, res, next) {
  converse(req.body)
  .then(function(result){
    res.json(result[0]);
  })
  .catch(next);
});

// converse
app.post('/api/conversation', function(req, res, next) {
  log('--------------------------');
  log('1. classifying user intent');
  getIntent({ text: req.body.input })
  .then(function(result) {
    log('2. updating the dialog profile with the user intent');
    log("----------------------------User Intent Result----------------------------------------------------")
    log(result[0].classes);
    var classes = result[0].classes;
    var profile = {
      client_id: req.body.client_id,
      name_values: [
        { name:'Class1', value: classes[0].class_name },
        { name:'Class1_Confidence', value: classes[0].confidence },
        { name:'Class2', value: classes[1].class_name },
        { name:'Class2_Confidence', value: classes[1].confidence }
      ]
    };
    return updateProfile(profile);
  })
  .catch(function(error ){
    log('2.', error.description || error);
  })
  .then(function() {
    log('3. calling dialog.conversation()');
    log("-------------------------------------Update Profile Result-------------------------------------------")
    log(req.body);
    return converse(req.body)
    .then(function(result) {
      var conversation = result[0];
      log("-------------------------------conversation results-------------------------------------------------")
      log(conversation);
      if (searchNow(conversation.response.join(' '))) {
        log('4. dialog thinks we have information enough to search for movies');
        var searchParameters = parseSearchParameters(conversation);
        conversation.response = conversation.response.slice(0, 1);

        return searchMovieDetails(searchParameters.movie_title)
        .then(function(movieTitleResult){    
            console.log("movieTitleResult: ");
            console.log(movieTitleResult);  
            return searchActorId(searchParameters.actor)
            .then(function(actorIdResult){
                console.log("actorId: " + actorIdResult);  
                return searchActorId(searchParameters.actor_2)
                .then(function(actorIdSecondResult){   
                    console.log("actorIdSecondResult: " + actorIdSecondResult);
                    return searchActorId(searchParameters.director)
                    .then(function(directorIdResult){
                        console.log("directorIdResult: " + directorIdResult);
                        log('6. searching for movies in themoviedb.com');
                        return searchMovies(searchParameters,actorIdResult,actorIdSecondResult,directorIdResult)
                        .then(function(searchResult) {
                          console.log('---------------Movie Search Results------------------------');
                            console.log(searchResult.movies);

                            log('7. updating the dialog profile with the result from themoviedb.com');
                            var profile = {
                              client_id: req.body.client_id,
                              name_values: [
                                { name:'Current_Index', value: searchResult.curent_index },
                                { name:'Total_Pages', value: searchResult.total_pages },
                                { name:'Num_Movies', value: searchResult.total_movies },
                                { name:'Wrong_Actor', value: searchResult.wrong_actor }
                              ]
                            };
                            return updateProfile(profile)
                            .then(function() {
                                log('8. calling dialog.conversation()');
                                var params = extend({}, req.body);
                                if (['new','repeat'].indexOf(searchParameters.page) !== -1)
                                  params.input = PROMPT_MOVIES_RETURNED;
                                else
                                  params.input = PROMPT_CURRENT_INDEX;

                                return converse(params)
                                .then(function(result) {
                                    res.json(extend(result[0], searchResult));
                                });
                            });
                        });
                    });
                });
            });
        });


      } else {
        log('4. not enough information to search for movies, continue the conversation');
        res.json(conversation);
      }
    });
  })
  .catch(next);
});

function searchNow(message) {
  return message.toLowerCase().indexOf('search_now') !== -1;
}

function parseSearchParameters(conversation) {
  var params = conversation.response[1].toLowerCase().slice(1, -1);
  params = params.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ');
  return JSON.parse(params);
}

app.get('/api/movies', function(req, res, next) {
  getMovieInformation(req.query)
  .then(function(movie){
    var profile = {
      client_id: req.body.client_id,
      name_values: [
        { name:'Selected_Movie', value: movie.movie_name },
        { name:'Popularity_Score', value: movie.popularity * 10 }
      ]
    };
    return updateProfile(profile)
    .then(function() {
      var params = {
        client_id: req.query.client_id,
        conversation_id: req.query.conversation_id,
        input: PROMPT_MOVIE_SELECTED
      };
      return converse(params)
      .then(function(result) {
        res.json(extend(result[0], { movies: [movie]}));
      });
    });
  })
  .catch(next);
});


/**
 * Returns the classifier_id and dialog_id to the user.
 */
app.get('/api/services', function(req, res) {
  res.json({
    dialog_id: apis ? apis.dialog_id : 'Unknown',
    classifier_id: apis ? apis.classifier_id : 'Unknown'
  });
});

// error-handler application settings
require('./config/error-handler')(app);
module.exports = app;