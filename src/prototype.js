//Time Management

//the last time we drew a frame
var lastFrame;
//how long it's been since we drew a frame
var frameTime;
//current number of ticks
var curTick;

//Data
var datasrc = "./data/test1.json";
var data;
var minX = 0;
var maxX = 1;
var minY = 0;
var maxY = 1;
var minT = 0;

//a 2d array of event objects. each row is a tick. events need an x and y.
var events;

//array of spatial models. each has an initial state (corresponding to priors), a per-event update method, and
//propbability accessors.
var models;
var showmaps = true;
var modelResolution = 50;

//Popcorn
//"active" events that are still "popping"
var popcorn;
var popcornModes = {
  RECT: 0,
  CIRCLE: 1
};
var popcornMode = popcornModes.CIRCLE;


//Histograms
var eventDensity;
var surpriseDensity;

//Maps
var eventMap;
var eventImg;
var eventResolution = 250;
var kernelSize = 12;

//ColorBrewer ramps
var cbRed = ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#b30000','#7f0000'];
var cbPurple = ['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#810f7c','#4d004b'];
var cbGreen = ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#006837','#004529'];
var cbGrey = ['#ffffff','#f0f0f0','#d9d9d9','#bdbdbd','#969696','#737373','#525252','#252525','#000000'];

/***********
 p5 Core Methods
 ************/

function preload(){
  loadJSON(datasrc,loadData);
  
  
}

function loadData(theJSON){
  data = theJSON;
  if(data.overlay){
    overlay = loadImage("./data/"+data.overlay);
  }
  if(data.minX){
    minX = data.minX;
  }
  if(data.maxX){
    maxX = data.maxX;
  }
  if(data.minY){
    minY = data.minY;
  }
  if(data.maxY){
    maxY = data.maxY;
  }
  if(data.src){
    loadTable("./data/"+data.src,loadCSV,"csv","header");
  }
}

function loadCSV(theCSV){
  //console.log(theCSV);
  var T,X,Y;
  // var minT = data.minT ? data.minT : 0;
  // var maxT = data.maxT ? data.maxT : theCSV.getRowCount();
  // events = Array(maxT-minT+1);
  events =  Array(theCSV.getRowCount());
  for(var i = 0;i<events.length;i++){
    events[i] = [];
  }
  for(var i=0;i<theCSV.getRowCount();i++){
    T = theCSV.getString(i,"Time");
    X = theCSV.getString(i,"X");
    Y = theCSV.getString(i,"Y");
    //events[T-minT].push({x: X, y: Y});
    events[i].push({x: X, y: Y});
  }
  
}

function setup(){
  pixelDensity(displayDensity());
  createCanvas(windowWidth-20,windowHeight-20);
  eventImg = createGraphics(2*eventResolution,2*eventResolution);
  //eventImg.draw = function(){ background(255,0,0);};
  background(255);
  lastFrame = millis();
  frameTime = 1000/30;
  
  curTick = 0;
  models = [];
  //models.push(new StaticGaussian(0.5,0.25,modelResolution));
  models.push(new Gaussian(modelResolution));
  models.push(new Uniform(modelResolution));
  models.minS = 0;
  models.maxS = 0;
  popcorn = [];
  eventDensity = [];
  eventDensity.minD = 0;
  eventDensity.maxD = 0;
  surpriseDensity = [];
  surpriseDensity.minD = 0;
  surpriseDensity.maxD = 0;
  
  eventMap = initializeMap(eventResolution,0);
  eventMap.kernel = initializeKernel(kernelSize);
  
  if(!events){
    makeTestData();
  }
  
  ellipseMode(RADIUS);
  updateMap(eventMap,cbPurple,eventImg);
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
  var lifespan = 30;
  var xc = 0;
  var yc = 0;
  if(curTick<events.length){
    if(events[curTick] && events[curTick].length > 0){
      for(var i = 0;i<events[curTick].length;i++){
        S = getSurprise(events[curTick][i]);
        if(models.maxS ===0){
          lifespan = 30;
        }
        else{
          lifespan = map(S,models.minS,models.maxS,30,90);
        }
        sediment(events[curTick][i]);
        popcorn.push({x: events[curTick][i].x, y: events[curTick][i].y, life: lifespan , age: 0, surprise: S});
        avgS+= S;
      }
      avgS/= events[curTick].length;
      updateMap(eventMap,cbPurple,eventImg);
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


function sediment(event){
  // Update our main heatmap display of event density. Currently uses kde.
  // Also updates summary statistics using recurrence relationships from Knuth.
  var yc = floor(map(event.y,minY,maxY,eventMap.length-1,0));
  var xc = floor(map(event.x,minX,maxX,0,eventMap[yc].length-1));
  var ykc,xkc,mk1x,mk1y;
  
  
  if(!eventMap.n || eventMap.n==0){
    eventMap.n = 1;
    eventMap.mu = {x: event.x, y: event.y};
    eventMap.sn = {x: 0,y: 0};
    eventMap.sigma = {x:0,y:0};
  }
  else{
    mk1x = eventMap.mu.x;
    mk1y = eventMap.mu.y;
    eventMap.mu.x = ((eventMap.n*eventMap.mu.x)+event.x)/(eventMap.n+1);
    eventMap.mu.y = ((eventMap.n*eventMap.mu.y)+event.y)/(eventMap.n+1);
    eventMap.sn.x = eventMap.sn.x + ((event.x - mk1x)*(event.x - eventMap.mu.x));
    eventMap.sigma.x = sqrt(eventMap.sn.x / (eventMap.n));
    eventMap.sn.y = eventMap.sn.y + ((event.y - mk1y)*(event.y - eventMap.mu.y));
    eventMap.sigma.y = sqrt(eventMap.sn.y / (eventMap.n));
    eventMap.n++;
  }
  
  for(var i = 0;i<eventMap.kernel.length;i++){
    for(var j = 0;j<eventMap.kernel[i].length;j++){
      xkc = xc + j - eventMap.kernel[i].length/2;
      ykc = yc + i - eventMap.kernel.length/2;
      if(xkc >= 0 && ykc >= 0 && ykc < eventMap.length && xkc< eventMap[ykc].length){
        eventMap[ykc][xkc] += eventMap.kernel[i][j];
        if(eventMap[ykc][xkc] > eventMap.maxD){
          eventMap.maxD = eventMap[ykc][xkc];
        }
      }
    }
  }
  
  for(var i = 0;i<models.length;i++){
    models[i].update(event);
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
  // Only draw at maximum once per target frame rate.
  if(millis()-lastFrame>frameTime){
    updatePopcorn();
    lastFrame = millis();
    tick();
    drawAll();
  }
}

function drawAll(){
  // Draw every darn thing we need:
  // Histograms for temporal event density and surprise density,
  // A map of events to date, and maps for each prior
  background(255);
  drawHistogram(0,0,width,height/20,eventDensity,cbGreen);
  drawHistogram(0,(height/20) + 5  ,width,(height/20) - 5,surpriseDensity,cbRed);
  noTint();
  if(showmaps){
    drawMap(0,(height+5)/10,width-1,(3*height/5)-5,eventImg);
    if(data.overlay){
      tint(255,128);
      image(overlay,0,(height+5)/10,width-1,(3*height/5)-5);
      noTint();
    }
    drawPopcorn(0,(height+5)/10,width-1,(3*height/5)-5,cbRed);
  
    
    var modelw = width/models.length;
    for(var i = 0;i<models.length;i++){
      models[i].draw(i*modelw,(7*height)/10,modelw,(3*height)/10);
    }
  }
  else{
    drawMap(0,(height+5)/10,width-1,height-((height+5)/10),eventImg);
    if(data.overlay){
      tint(255,128);
      image(overlay,0,(height+5)/10,width-1,height-((height+5)/10));
      noTint();
    }
    drawPopcorn(0,(height+5)/10,width-1,height-((height+5)/10),cbRed);
  }
}

function drawMap(x,y,w,h,canvas){
  // Draws a 2d histogram, based on a particualr frame buffer
  // If the map needs to change, call updateMap
  image(canvas,0,0,canvas.width,canvas.height,x,y,w,h);
}

function updateMap(aMap,colorramp,canvas){
  // Assumes a map is a row major 2d array with a "maxD" property encoding maximum density
  // Writes to the p5 equivalent of a frame buffer on an update, otherwise just displays the buffer contents.
  
  //I'm doing it this way because otherwise high resolution maps take forever to redraw, and we'd have to redraw
  // each time a popcorn event was fired or updated (since we're using alpha blending). Still not great timewise, because we have to draw every cell (since our maxD might've changed.
  colorramp = colorramp ? colorramp : cbRed;
  var fillC;
  canvas.loadPixels();
  canvas.background(255,0,0);
  for(var i = 0; i<aMap.length;i++){
    for(var j = 0;j<aMap[i].length;j++){
      fillC = colorramp[(floor(map(aMap[i][j],aMap.minD,aMap.maxD,0,colorramp.length-1)))];
      if(!fillC){
        fillC = colorramp[0];
      }
      canvas.set(j,i,color(fillC));
      //canvas.set(i,j,fillC);
    }
  }
  canvas.updatePixels();
}

function drawHistogram(x,y,w,h,histogram,colorramp){
  //Draws a dual-encoded violin-style histogram using beziers for interpolation. Should probably use monotone cubic interpolator instead.
  
  //Assumes a histogram is an array with minD and maxD properties.
  colorramp = colorramp ? colorramp : cbRed;
  var dx = w/histogram.length;
  var curx = 0;
  var dy;
  var fillC;
  var cI;
  push();
  translate(x,y);
  for(var i = 0;i<histogram.length;i++){
    dy = map(histogram[i],histogram.minD,histogram.maxD,h,0);
    
    //index of our value, in our given color ramp
    cI = floor(map(histogram[i],histogram.minD,histogram.maxD,0,colorramp.length-1));
    
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
  //Uses animation and halos for pixel boosting, as per Oelke et al 2011.
  
  //radius
  var pr;
  //color
  var pc;
  //alpha
  var pa;
  
  //maximum radius of popcorn
  var maxR = 100;
  var minR = 5;
 
  //location and size w/r/t the event map
  var yc,xc;
  var dx = w/eventMap[0].length;
  var dy = h/eventMap.length;
  
  var sval;
  push();
  translate(x,y);
  for(var i = 0;i<popcorn.length;i++){
    noStroke();
    sval = map(popcorn[i].surprise,models.minS,models.maxS,0,1);
    if(!sval){
      sval = 0;
    }
    yc = floor(map(popcorn[i].y,minY,maxY,eventMap.length-1,0));
    xc = floor(map(popcorn[i].x,minX,maxX,0,eventMap[yc].length-1));
    pr = map(popcorn[i].age,1,popcorn[i].life,minR,constrain(sval*maxR,minR,maxR));
    pa = map(popcorn[i].age,1,popcorn[i].life,0,1);
    pc = colorramp[floor(map(sval,0,1,0,colorramp.length-1))];
    
    //halo
    fill(lerpColor(color(pc),color(255,0),pa));
    
    if(popcornMode === popcornModes.RECT){
      //halo
      rect((xc*dx) - (pr/2),(yc*dy) - (pr/2),dx + pr,dy + pr);
      fill(pc);
      //centroid
      rect(xc*dx,yc*dy,dx,dy);
    }
    else if(popcornMode === popcornModes.CIRCLE){
      //halo
      ellipse((xc*dx) + (dx/2),(yc*dy) + (dy/2),pr,pr);
      fill(pc);
      //centroid
      ellipse((xc*dx) + (dx/2),(yc*dy) + (dy/2),max(max(dx,dy)/2.0,5),max(max(dx,dy)/2.0,5));
    }
  }
  pop();
}

function getDensity(event){
  if(eventMap && eventMap.n){
    if(eventMap.n==0){
      return 1;
    }
    else{
      var yc = floor(map(event.y,minY,maxY,0,eventMap.length-1));
      var xc = floor(map(event.x,minX,maxX,0,eventMap[yc].length-1));
      return eventMap[yc][xc]/eventMap.maxD;
    }
  }
  else{
    return 0;
  }
}

function sum(anArray){
  var curSum = 0;
  for(var i = 0;i<anArray.length;i++){
    curSum+=anArray[i];
  }
  return curSum
}

function getSurprise(event){
  // How surprising is this event?
  // Must return a normalized value in [0,1],
  // even though the measures are in bits.
  var sumS = 0;
  var sumP = 0;
  var mS = 0;
  for(var i = 0;i<models.length;i++){
    //console.log(models[i].name+":"+ models[i].surprise(event));
    if(!models[i].disabled){
      
      //mS = models[i].pmd(event) * (log ( models[i].pmd(event) / models[i].pm)/log(2));
      mS = models[i].pm * models[i].surprise(event);
      //mS = models[i].surprise(event);
      if(!mS){
        mS = 0;
      }
      sumS+= mS;
      //console.log("S("+models[i].name + ")= " + mS );
      sumP+= models[i].pm;
    }
  }
  
  for(var i = 0;i<models.length;i++){
    models[i].pm/=sumP;
    //console.log("P("+models[i].name + ")=" + models[i].pm);
  }
  
  if(sumS<models.minS){
    models.minS = sumS;
    surpriseDensity.minD = sumS;
  }
  if(sumS>models.maxS){
    models.maxS = sumS;
    surpriseDensity.maxD = sumS;
  }
  
  //console.log("sum:" + sumS);
  return sumS;
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

/***********
 Model Methods
 ************/

function Prior(resolution,initialP){
  this.resolution = resolution ? resolution : 20;
  this.map = initializeMap(this.resolution,0);
  this.map.minD = 0;
  this.mapImg = createGraphics(2*resolution,2*resolution);
  this.name = "default prior";
  this.disabled = false;
  this.pm = initialP ? initialP : 1;
  this.update = function(event){
    this.pm= (this.pm + (this.pmd(event)))/ 2;
    this.updateMap();
  };
  this.surprise = function(event){
    return 0;
  };
  this.updateMap = function(){
    if(showmaps){
      var xc,yc;
      for(var i = 0;i<this.map.length;i++){
        for(var j = 0;j<this.map[i].length;j++){
          xc = map((j+0.5)/this.map[i].length,0,1,minX,maxX);
          yc = map((i+0.5)/this.map.length,0,1,minY,maxY);
          this.map[i][j] = this.surprise({x: xc, y: yc});
          if(this.map[i][j]>this.map.maxD){
            this.map.maxD = this.map[i][j];
          }
          if(this.map[i][j] <this.map.minD){
            this.map.minD = this.map[i][j];
          }
        }
      }
      if(this.disabled){
        updateMap(this.map, cbGrey, this.mapImg);
      }
      else{
        updateMap(this.map, cbRed, this.mapImg);
      }
    }
  };
  
  this.draw = function(x,y,w,h){
    var borderC = this.pm<=1 && this.pm>=0 ? cbRed[floor(map(this.pm,0,1,0,cbRed.length-1))] : cbRed[0];
    drawMap(x,y,w,h,this.mapImg);
    fill(0,0);
    strokeWeight(1);
    stroke(borderC);
    rect(x,y,w-1,h-1);
  }
}

function StaticGaussian(mu,sigma,resolution,initialP){
  //A static gaussian prior.
  Prior.apply(this,[resolution]);
  this.mu = {};
  this.mu.x = mu.x ? mu.x : mu;
  this.mu.y = mu.y ? mu.y : mu;
  this.sigma = {};
  this.sigma.x = sigma.x ? sigma.x : sigma;
  this.sigma.y = sigma.y ? sigma.y : sigma;
  this.name = "staticGaussian("+this.mu.x+","+this.sigma.x+")";
  this.pmd = function(event){
    //Probability of the model, given the data.
    return this.pm * (this.pdm(event));
  };
  this.pdm = function(event){
    //Probability of the data, given the model is the density
    var dist = sqrt ( sq( (event.x-this.mu.x) / this.sigma.x) + sq( (event.y-this.mu.y) / this.sigma.y));
    var expected = gaussPDF(dist)/gaussPDF(0);
    var actual = getDensity(event);
    return 1- abs(actual-expected);
  };
  this.surprise = function(event){
    //kl( p(m | d),p(m)) = p(m | d ) * log ( p(m | d) / p(m) )
    //return this.pmd(event) * (log ( this.pmd(event) / this.pm)/log(2));
    return 1- this.pdm(event);
    //return this.pdm(event);
  };
  this.updateMap();
  
}

function Gaussian(resolution,initialP){
  //A dynamic gaussian prior.
  Prior.apply(this,[resolution]);
  this.mu = {x: 0,y:0};
  this.sigma = {x: 1, y: 1};
  this.name = "Gaussian("+this.mu.x+","+this.sigma.x+")";
  
  this.update = function(event){
    
    //average this step to downweight single datapoints
    this.pm= (this.pm + (this.pmd(event)))/ 2;
    this.mu = eventMap.mu;
    this.sigma = eventMap.sigma;
    this.updateMap();
  };
  this.pmd = function(event){
    //Probability of the model, given the data.
    return this.pm * (this.pdm(event));
  };
  this.pdm = function(event){
    //Probability of the data, given the model is the density
    var dist = sqrt ( sq( (event.x-this.mu.x) / this.sigma.x) + sq( (event.y-this.mu.y) / this.sigma.y));
    var expected = gaussPDF(dist)/gaussPDF(0);
    var actual = getDensity(event);
    return 1 - abs(actual-expected);
  };
  this.surprise = function(event){
    //kl( p(m | d),p(m)) = p(m | d ) * log ( p(m | d) / p(m) )
    //return this.pmd(event) * (log ( this.pmd(event) / this.pm)/log(2));
    //return (this.pdm(event));
    return 1-this.pdm(event);
  };
  this.updateMap();
  
}

function Uniform(resolution,initialP){
  //A uniform prior.
  Prior.apply(this,[resolution]);
  this.name = "Uniform";
  this.update = function(event){
    this.pm= (this.pm + (this.pmd(event)))/ 2;
    this.updateMap();
  };
  this.pmd = function(event){
    //Probability of the model, given the data.
    return this.pm * (this.pdm(event));
  };
  this.pdm = function(event){
    //Probability of the data, given the model is the density
    if(eventMap && eventMap.n>1){
      var expected = gaussPDF(0) / (eventMap.length*eventMap[0].length);
      var actual = getDensity(event);
      return 1 - abs(actual-expected);
    }
    else{
      return 1;
    }
  };
  this.surprise = function(event){
    //kl( p(m | d),p(m)) = p(m | d ) * log ( p(m | d) / p(m) )
    //return this.pmd(event) * (log ( this.pmd(event) / this.pm)/log(2));
    return 1- this.pdm(event);
  };
  this.updateMap();
  
}
  
  


/***********
 Demo Methods
 ************/

function makeTestData(){
  var toAdd = 0;
  events = new Array(200);
  events[0] = [];
  for(var i = 0;i<events.length;i++){
    toAdd = floor(randomGaussian(1,3));
    events[i] = [];
    for(var j = 0;j<toAdd;j++){
      events[i][j] = {x: constrain(randomGaussian(0.5,0.25),0,1), y: constrain(randomGaussian(0.5,0.25),0,1)};
    }
  }
}

function pushEvents(){
  //If we run out of events in our data src, but still want to add some more items in.
  var toAdd = floor(randomGaussian(1,3))
  var newevents = [];
  for(var i = 0;i<toAdd;i++){
    newevents[i] = {x: constrain(randomGaussian(0.5,0.25),0,1), y: constrain(randomGaussian(0.5,0.25),0,1)};
  }
  events.push(newevents);
  tick();
}

function toggleMaps(){
  showmaps = !showmaps;
  for(var i = 0;i<models.length;i++){
    models[i].updateMap();
  }
  drawAll();
}

function toggleAMap(index){
  if(index >=0 && index<models.length){
    models[index].disabled = !models[index].disabled;
    models[index].updateMap();
    drawAll();
  }
}

