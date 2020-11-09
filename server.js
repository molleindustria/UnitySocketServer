//create a web application that uses the express frameworks and socket.io to communicate via http (the web protocol)
var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

//the rate the server updates all the clients, 
//10fps to simulate a major lag and introduce predictive logic
//setInterval works in milliseconds
var UPDATE_TIME = 1000 / 30;

//keep track of the time elapsed between updates for the physics based math
var lastUpdate = Date.now();
var deltaTime = 0;

//Gameplay variables
//size of canvas
var WIDTH = 800;
var HEIGHT = 500;
var WRAP_MARGIN = 20;
var MAX_VELOCITY = 20;
var ACCELERATION = 60;
var FRICTION = 0.8;
var COLLIDER_RADIUS = 40;

var DEATH_TIMEOUT = 4; //in seconds
//id for the states
var ROCK = 0;
var PAPER = 1;
var SCISSORS = 2;
var DEAD = 3;

//We want the server to keep track of the whole game state and the clients just to send updates
var gameState = {
    players: {}
}

//when a client connects serve the static files in the public directory ie public/index.html
app.use(express.static('public'));

//when a client connects 
io.on('connection', function (socket) {
    //this appears in the server's terminal
    console.log('A user connected');


    //this is sent to the client upon connection
    //socket.emit('message', 'Hello welcome!');
    //in unity it needs to be an object
    socket.emit('message', { message: "Hello welcome" });


    //create player object
    //randomize initial position and set velocity to 0
    gameState.players[socket.id] = {
        x: random(0, WIDTH),
        y: random(0, HEIGHT),
        vX: 0,
        vY: 0,
        angle: 0,
        state: Math.floor(random(0, 3)), //RPS number, must be an integer
        counter: -1 //timeoutcounter after defeat
    }

    //when I receive an update from a client, update the game state
    socket.on('clientUpdate', function (controls) {
        //I don't want to calculate positions here since clients may send updates at different times
        //so I just save the latest control state and do all the math in the general update function below
        gameState.players[socket.id].controls = controls;
    });

    /* commented as I'm splitting in two events for unity
    //instant change of state step is -1 or +1 previous or next
    socket.on('stateChange', function (step) {

        //ignore input if state is dead
        //that's why I don't keep this logic on the client side
        if (gameState.players[socket.id].state != DEAD) {
            var state = gameState.players[socket.id].state + step;
            //rotate
            if (state > 2) state = 0;
            if (state < 0) state = 2;
            gameState.players[socket.id].state = state;
        }
    });
    */

    //instant change of state 
    socket.on('previousState', function (step) {

        //ignore input if state is dead
        //that's why I don't keep this logic on the client side
        if (gameState.players[socket.id].state != DEAD) {
            var state = gameState.players[socket.id].state - 1;
            //rotate
            if (state < 0) state = 2;
            gameState.players[socket.id].state = state;
        }
    });

    //instant change of state 
    socket.on('nextState', function (step) {

        //ignore input if state is dead
        //that's why I don't keep this logic on the client side
        if (gameState.players[socket.id].state != DEAD) {
            var state = gameState.players[socket.id].state + 1;
            //rotate
            if (state > 2) state = 0;
            gameState.players[socket.id].state = state;
        }
    });

    //when a client disconnects I have to delete its player object
    //or I would end up with ghost players
    socket.on('disconnect', function () {
        console.log("User disconnected - destroying player " + socket.id);
        //delete the player object
        delete gameState.players[socket.id];
        console.log("There are now " + Object.keys(gameState.players).length + " players");
    });


});//end of connected client


//setInterval calls the function at the given interval in time
//the server sends the whole game state to all players
//this is where I calculate all the velocities and positions at the same time
setInterval(function () {

    //deltaTime is the time in seconds between updates
    //just use it as multiplier to make movements "framerate" independent
    var now = Date.now();
    deltaTime = (now - lastUpdate) / 1000;
    lastUpdate = now;


    //iterate through the players
    for (var playerId in gameState.players) {

        var p = gameState.players[playerId];

        if (p.controls != null) {

            //update speed
            if (p.controls.left)
                p.vX -= ACCELERATION * deltaTime;
            if (p.controls.right)
                p.vX += ACCELERATION * deltaTime;

            if (p.controls.up)
                p.vY -= ACCELERATION * deltaTime;
            if (p.controls.down)
                p.vY += ACCELERATION * deltaTime;

            //apply friction only if not moving
            if (!p.controls.left && !p.controls.right)
                p.vX *= FRICTION;
            if (!p.controls.up && !p.controls.down)
                p.vY *= FRICTION;

            //limit speed
            p.vX = constrain(p.vX, -MAX_VELOCITY, MAX_VELOCITY);
            p.vY = constrain(p.vY, -MAX_VELOCITY, MAX_VELOCITY);

            //rotate according to speed
            p.angle = degrees(Math.atan2(p.vY, p.vX));

            //update position
            p.x += p.vX;
            p.y += p.vY;

            //screen wrap
            if (p.x > WIDTH + WRAP_MARGIN)
                p.x = -WRAP_MARGIN;

            if (p.x < -WRAP_MARGIN)
                p.x = WIDTH + WRAP_MARGIN;

            //screen wrap
            if (p.y > HEIGHT + WRAP_MARGIN)
                p.y = -WRAP_MARGIN;

            if (p.y < -WRAP_MARGIN)
                p.y = HEIGHT + WRAP_MARGIN;
        }

        //if player is dead (on timeout) decrease the counter
        if (p.counter > 0) {
            p.counter -= deltaTime;
            //if timeout ended randomize state
            if (p.counter < 0) {
                p.state = Math.floor(random(0, 3)); //RPS number, must be an integer
            }
        }


        //check this player collisions against all other players
        for (var otherPlayerId in gameState.players) {
            //don't check on myself
            if (otherPlayerId != playerId) {
                p2 = gameState.players[otherPlayerId];
                //collision though simple distance, assumes all the object are of the same size
                //pythagoras
                var a = p.x - p2.x;
                var b = p.y - p2.y;
                var dist = Math.sqrt(a * a + b * b);
                //collision happens, resolve state
                if (dist < COLLIDER_RADIUS * 2) {
                    //conditions for p1 win
                    if ((p.state == ROCK && p2.state == SCISSORS) ||
                        (p.state == PAPER && p2.state == ROCK) ||
                        (p.state == SCISSORS && p2.state == PAPER)) {
                        p2.state = DEAD;
                        p2.counter = DEATH_TIMEOUT;
                    }//conditions for p2 victory
                    else if ((p2.state == ROCK && p.state == SCISSORS) ||
                        (p2.state == PAPER && p.state == ROCK) ||
                        (p2.state == SCISSORS && p.state == PAPER)) {
                        p.state = DEAD;
                        p.counter = DEATH_TIMEOUT;
                    }

                }
            }
        }

    }

    //this would be nice but Unity won't understand the gameState data structure once it's passed through json
    //io.sockets.emit('state', gameState);

    /*
    Unity's JSON utility can't serialize dictionaries so we break down the players state in two arrays.
    What in javascript can be expressed as:
    players["playerSocket213"].x    //100;

    it will have to be split in two arrays:
    playerIds[0]     //playerSocket213
    player[0].x     //100
    */

    var keys = keysToArray(gameState.players);
    var values = valuesToArray(gameState.players);

    io.sockets.emit('state', { playerIds: keys, players: values });

}, UPDATE_TIME);


//listen to the port 3000
http.listen(3000, function () {
    console.log('listening on *:3000');
});

//assuming a key,value object type these two functions create corresponding arrays of keys and values
function keysToArray(obj) {
    var arr = [];
    for (var key in obj) {
        arr.push(key);
    }

    return arr;
}

function valuesToArray(obj) {
    var arr = [];
    for (var key in obj) {
        arr.push(obj[key]);
    }

    return arr;
}

//just random range
function random(min, max) {
    return Math.random() * (max - min) + min;
}

function print(m) {
    console.log(m);
}

function radians(degrees) {
    return degrees * (Math.PI / 180);
}

function degrees(radians) {
    return radians * (180 / Math.PI);
}


function constrain(n, min, max) {
    return Math.min(Math.max(n, min), max);
};
