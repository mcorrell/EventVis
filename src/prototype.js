//Time Management

//the last time we drew a frame
var lastFrame;
//how long it's been since we drew a frame
var frameTime;
//current number of ticks
var curTick;
//how many frames until we tick
var tickrate;

//Data
var datasrc = "./data/test1.json";
var data;

//a 2d array of event objects. each row is a tick. events need an x and y.
var events;
var models;


//Popcorn
//"active" events that are still "popping"
var popcorn;



//Histograms
var eventDensity;
var surpriseDensity;

//Maps
var eventMap;

//ColorBrewer ramps
var cbRed = ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#b30000','#7f0000'];
var cbPurple = ['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#810f7c','#4d004b'];
var cbGreen = ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#006837','#004529'];

/***********
 p5 Core Methods
 ************/

function preload(){
  // data = loadJSON(datasrc);
}

function setup(){
  pixelDensity(displayDensity());
  createCanvas(windowWidth-20,windowHeight-20);
  background(255);
  lastFrame = millis();
  frameTime = 1000/30;
  
  curTick = 0;
  models = [];
  events = [];
  popcorn = [];
  eventDensity = [];
  eventDensity.maxD = 0;
  surpriseDensity = [];
  surpriseDensity.maxD = 0;
  
  eventMap = initializeMap(100,0);
  eventMap.kernel = initializeKernel(3);
  
  if(!data){
    makeTestData();
  }
  
  ellipseMode(RADIUS);
}

function windowResized(){
  resizeCanvas(windowWidth-20,windowHeight-20);
}

function mousePressed(){
  tick();
}

/***********
 Time Methods
 ************/

function tick(){
  //A single timestep from our data. Currently only fires on mouseclick, will eventually fire every n frames.
  //Needs to push new events to their respective arrays, and update our histograms of surprise and density
  
  var avgS = 0;
  var S = 0;
  var xc = 0;
  var yc = 0;
  if(curTick<events.length){
    if(events[curTick] && events[curTick].length > 0){
      for(var i = 0;i<events[curTick].length;i++){
        S = random();
        sediment(events[curTick][i]);
        
        popcorn.push({x: events[curTick][i].x, y: events[curTick][i].y, life: ceil(S*90), age: 0, surprise: S});
        
        avgS+= S;
      }
      avgS/= events[curTick].length;
    }
    
    surpriseDensity[curTick] = avgS;
    if(surpriseDensity[curTick]>surpriseDensity.maxD){
      surpriseDensity.maxD = surpriseDensity[curTick];
    }
    
    eventDensity[curTick] = events[curTick].length;
    if(eventDensity[curTick]>eventDensity.maxD){
      eventDensity.maxD = eventDensity[curTick];
    }
    
    curTick++;
  }
}

function updatePopcorn(){
  //Increment the age of all our popping events, kill off the ones that are dead.
  //Fires every frame.
  var tocut;
  popcorn.sort(function(a,b){ return (b.life-b.age)-(a.life-a.age);});
  for(var i = 0;i<popcorn.length;i++){
    if(popcorn[i].age >= popcorn[i].life  && !tocut){
      tocut = i;
    }
    popcorn[i].age++;
  }
  if(tocut || tocut===0){
    popcorn.splice(tocut, popcorn.length-tocut);
  }
  
}

/***********
Draw Methods
************/

function draw(){
  if(millis()-lastFrame>frameTime){
    updatePopcorn();
    lastFrame = millis();
    drawAll();
  }
  //  drawPopcorn(0,(height+5)/10,width-1,(3*height/5)-5,cbRed);
}

function drawAll(){
  background(255);
  drawHistogram(0,0,width,height/20,eventDensity,cbGreen);
  drawHistogram(0,(height/20) + 5  ,width,(height/20) - 5,surpriseDensity,cbRed);
  drawMap(0,(height+5)/10,width-1,(3*height/5)-5,eventMap,cbPurple);
  drawPopcorn(0,(height+5)/10,width-1,(3*height/5)-5,cbRed);
}

function drawMap(x,y,w,h,aMap,colorramp){
  //assumes a map is a row major 2d array with a "maxD" property encoding maximum density
  colorramp = colorramp ? colorramp : cbRed;
  var dy = h/aMap.length;
  var dx = w/aMap[0].length;
  var curx = 0;
  var cury = 0;
  var fillC;
  push();
  translate(x,y);
  for(var i = 0; i<aMap.length;i++){
    curx = 0;
    for(var j = 0;j<aMap[i].length;j++){
      noStroke();
      fillC = colorramp[(floor(map(aMap[i][j],0,aMap.maxD,0,colorramp.length-1)))];
      if(!fillC){
        fillC = colorramp[0];
      }
      fill(fillC);
      rect(curx,cury,dx,dy);
      curx+= dx;
    }
    cury+=dy;
  }
  pop();
}

function drawHistogram(x,y,w,h,histogram,colorramp){
  //Draws a dual-encoded violin-style histogram using beziers for interpolation. Should probably use monotone cubic interpolator instead.
  
  //Assumes a histogram is an array with a "maxD" property encoding maximum density
  colorramp = colorramp ? colorramp : cbRed;
  var dx = w/histogram.length;
  var curx = 0;
  var dy;
  var fillC;
  var cI;
  push();
  translate(x,y);
  for(var i = 0;i<histogram.length;i++){
    dy = map(histogram[i],0,histogram.maxD,h,0);
    
    //index of our value, in our given color ramp
    cI = floor(map(histogram[i],0,histogram.maxD,0,colorramp.length-1));
    
    //map doesn't deal well with division by zero (for instance if our maxD is zero and our value is also 0)
    if(isNaN(cI)){
      fillC = colorramp[0];
    }
    else{
      fillC = colorramp[cI];
    }
    
    fill(fillC);
    noStroke();
    
    
    //Our control points are our previous value p1, our current value dy, and our next value p2
    var p1 = i>0 ? map((histogram[i] + histogram[i-1]) /2,0,histogram.maxD,h,0) : h;
    var p2 = i<histogram.length-1 ? map((histogram[i] + histogram[i+1]) /2,0,histogram.maxD,h,0) : dy;
    
    
    //Two calls here out of sheer laziness: one half of the violin, then flip and draw the other half
    push();
    translate(0,0);
    scale(1,0.5);
    beginShape();
    vertex(curx,h);
    vertex(curx,p1);
    bezierVertex(curx,p1 + ((dy-p1)/4),curx + (3*dx/8), dy,curx+(dx/2),dy);
    bezierVertex(curx + (5*dx/8),dy, curx+dx,dy +  ((p2-dy)/4), curx+dx,p2);
    vertex(curx+dx,p2);
    vertex(curx+dx,h);
    endShape();
    pop();
    
    push();
    translate(0,h);
    scale(1,-0.5);
    beginShape();
    vertex(curx,h);
    vertex(curx,p1);
    bezierVertex(curx,p1 + ((dy-p1)/4),curx + (3*dx/8), dy,curx+(dx/2),dy);
    bezierVertex(curx + (5*dx/8),dy, curx+dx,dy +  ((p2-dy)/4), curx+dx,p2);
    vertex(curx+dx,p2);
    vertex(curx+dx,h);
    endShape();
    pop();
    
    //Ensures a minimum width as well as deals with pesky off by one errors for floating point widths
    stroke(fillC);
    strokeWeight(2);
    line(curx+2,h/2,curx+dx-2,h/2);
    
    curx+=dx;
  }

  pop();
}

function drawPopcorn(x,y,w,h,colorramp){
  //Popcorn pops have an age that increments to a maximum, and an initial surprise that controls their color
  //They begin at a minimum radius and then expand outwards over time, fading as they do so.
  
  //radius
  var pr;
  //color
  var pc;
  //alpha
  var pa;
  //x
  var px;
  //y
  var py;
  
  //maximum radius of popcorn
  var maxR = 50;
  var minR = 5;
 
  
  var yc,xc;
  var dx = w/eventMap[0].length;
  var dy = h/eventMap.length;
  
  

  
  push();
  translate(x,y);
  for(var i = 0;i<popcorn.length;i++){
    noStroke();
    yc = floor(map(popcorn[i].y,0,1,eventMap.length-1,0));
    xc = floor(map(popcorn[i].x,0,1,0,eventMap[yc].length-1));
    pr = map(popcorn[i].age,1,popcorn[i].life,minR,constrain(popcorn[i].surprise*maxR,minR,maxR));
    pa = map(popcorn[i].age,1,popcorn[i].life,0,1);
    pc = colorramp[floor(map(popcorn[i].surprise,0,1,0,colorramp.length-1))];
    px = map(popcorn[i].x,0,1,0,w);
    py = map(popcorn[i].y,0,1,h,0);
    fill(lerpColor(color(pc),color(255,0),pa));
    rect((xc*dx) - (pr/2),(yc*dy) - (pr/2),dx + pr,dy + pr);
    //ellipse((xc*dx) + (dx/2) ,(yc*dy) + (dy/2),pr,pr);
    
    fill(pc);
    rect(xc*dx,yc*dy,dx,dy);
    
  }
  pop();
}


function initializeMap(resolution,initialVal){
  var initial = initialVal ? initialVal : 0;
  var aMap = new Array(resolution);
  for(var i = 0;i<aMap.length;i++){
    aMap[i] = new Array(resolution);
    for(var j = 0;j<aMap[i].length;j++){
      aMap[i][j] = initial;
    }
  }
  aMap.maxD = initial;
  aMap.minD = initial;
  return aMap;
}

function makeTestData(){
  var toAdd = 0;
  events = new Array(200);
  for(var i = 0;i<events.length;i++){
    toAdd = floor(randomGaussian(1,3));
    events[i] = [];
    for(var j = 0;j<toAdd;j++){
      events[i][j] = {x: constrain(randomGaussian(0.5,0.25),0,1), y: constrain(randomGaussian(0.5,0.25),0,1)};
    }
  }
}

function pushEvents(){
  var toAdd = floor(randomGaussian(1,3))
  var newevents = [];
  for(var i = 0;i<toAdd;i++){
      newevents[i] = {x: constrain(randomGaussian(0.5,0.25),0,1), y: constrain(randomGaussian(0.5,0.25),0,1)};
  }
  events.push(newevents);
  tick();
}

function sediment(event){
  var yc = floor(map(event.y,0,1,eventMap.length-1,0));
  var xc = floor(map(event.x,0,1,0,eventMap[yc].length-1));
  var ykc,xkc,mk1x,mk1y;
  if(!eventMap.n || eventMap.n==0){
    eventMap.n = 1;
    eventMap.mu = {x: event.x, y: event.y};
    eventMap.sn = {x: 0,y: 0};
    eventMap.sigma = {x:0,y:0};
  }
  else{
    eventMap.mu.x = ((eventMap.n*eventMap.mu.x)+event.x)/(eventMap.n+1);
    eventMap.mu.y = ((eventMap.n*eventMap.mu.y)+event.y)/(eventMap.n+1);
    eventMap.sn.x = eventMap.sn.x + (event.x - mk1x)*(event.x - eventMap.mu.x);
    eventMap.sigma.x = sqrt(eventMap.sn.x / (eventMap.n));
    eventMap.sn.y = eventMap.sn.y + (event.y - mk1y)*(event.y - eventMap.mu.y);
    eventMap.sigma.y = sqrt(eventMap.sn.y / (eventMap.n));
    eventMap.n++;
  }
  
  for(var i = 0;i<eventMap.kernel.length;i++){
    for(var j = 0;j<eventMap.kernel[i].length;j++){
      xkc = xc + j - eventMap.kernel[i].length/2;
      ykc = yc + i - eventMap.kernel.length/2;
      if(xkc >= 0 && xkc< eventMap[i].length && ykc >= 0 && ykc < eventMap.length){
        eventMap[ykc][xkc] += eventMap.kernel[i][j];
        if(eventMap[ykc][xkc] > eventMap.maxD){
          eventMap.maxD = eventMap[ykc][xkc];
        }
      }
    }
  }
  
  
}

function initializeKernel(sigma){
  var kernel = new Array(6*ceil(sigma));
  var dist = 0;
  for(var i = 0;i<kernel.length;i++){
    kernel[i] = new Array(6*ceil(sigma));
    for(var j = 0;j<kernel[i].length;j++){
      dist = sqrt( sq(i-3*sigma) + sq(j-3*sigma));
      kernel[i][j] = gaussPDF(dist,sigma);
    }
  }
  return kernel;
}

function gaussPDF(x,sigma){
  sigma = sigma ? sigma : 1;
  return (1/(sigma*sqrt(2*PI)))*exp(-1* sq(x) / (2*sq(sigma)));
}