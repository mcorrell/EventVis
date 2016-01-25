var resolution = 35;
var events = [];
var densityModel = {};
var kdeModel = {};
var gaussModel = {};
var aggregateModel = {};

var models = [
densityModel,
kdeModel,
gaussModel,
aggregateModel
];
var modeli = 0;

var surpriseMap;
var eventMap;

//ColorBrewer ramps
var cbRed = ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#b30000','#7f0000'];
var cbPurple = ['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#810f7c','#4d004b'];
var cbGreen = ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#006837','#004529'];


function setup(){
  pixelDensity(displayDensity());
  createCanvas(windowWidth-20,windowHeight-20);
  background(220);
  textSize(14);
  surpriseMap = initializeMap();
  eventMap = initializeMap();
  
  densityModel.update = function(){return null;};
  densityModel.getS = function(xc,yc){
    return 1 - (eventMap[xc][yc])/eventMap.maxD;
  };
  kdeModel.map = initializeMap();
  kdeModel.kernel = initializeKernel(3);
  kdeModel.update = function(event){
    var xc = floor(map(event.x,0,1,0,resolution));
    var yc = floor(map(event.y,0,1,0,resolution));
    var xkc;
    var ykc;
    for(var i = 0;i<this.kernel.length;i++){
      for(var j = 0;j<this.kernel[i].length;j++){
        xkc = xc + i - this.kernel[i].length/2;
        ykc = yc + j - this.kernel.length/2;
        if(xkc >= 0 && xkc< resolution && ykc >= 0 && ykc < resolution){
          this.map[ykc][xkc] += this.kernel[i][j];
          if(this.map[ykc][xkc] > this.map.maxD){
            this.map.maxD = this.map[ykc][xkc];
          }
        }
      }
    }
  };
  kdeModel.getS = function(xc,yc){
    return 1 - this.map[yc][xc]/this.map.maxD;
  };
  gaussModel.update = function(event){ return null;};
  gaussModel.getS = function(xc,yc){
    var xmc = map(events.mu.x,0,1,0,resolution);
    var ymc = map(events.mu.y,0,1,0,resolution);
    var sigmaxc = map(events.sigma.x,0,1,0,resolution);
    var sigmayc = map(events.sigma.y,0,1,0,resolution);
    var xg = gaussPDF((xc-xmc),sigmaxc) / gaussPDF(0,sigmaxc);
    var yg = gaussPDF((yc-ymc),sigmayc) / gaussPDF(0,sigmayc);
    return 1- (xg*yg);

  }
  aggregateModel.update = function(event){
    return null;
  };
  aggregateModel.getS = function(xc,yc){
    return 0;
  };
  drawStep();
}


function initializeMap(initialVal){
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
  var kernel = new Array(6*sigma);
  var dist = 0;
  for(var i = 0;i<kernel.length;i++){
    kernel[i] = new Array(6*sigma);
    for(var j = 0;j<kernel[i].length;j++){
      dist = sqrt( sq(i-3*sigma) + sq(j-3*sigma));
      kernel[i][j] = gaussPDF(dist,sigma);
    }
  }
  return kernel;
}

function drawStep(){
  background(220);
  drawMap(eventMap,0,0,width/2);
  drawMap(surpriseMap,width/2,0,width/2);
}

function addEvent(event){
  sediment(event);
  for(var i = 0;i<models.length;i++){
    models[i].update(event);
  }
  updateSurprise();
  drawStep();
}

function sediment(event){
  if(events.length==0){
    events.mu = {x: event.x,y: event.y};
    events.sn = {x: 0,y: 0};
    events.sigma = {x: 0,y:0};
  }
  else{
    //Knuth reccurrence relationships in order to update descriptive stats.
    var mk1x = events.mu.x;
    var mk1y = events.mu.y;
    events.mu.x = ((events.length*events.mu.x)+event.x)/(events.length+1);
    events.mu.y = ((events.length*events.mu.y)+event.y)/(events.length+1);
    events.sn.x = events.sn.x + (event.x - mk1x)*(event.x - events.mu.x);
    events.sigma.x = sqrt(events.sn.x / (events.length));
    events.sn.y = events.sn.y + (event.y - mk1y)*(event.y - events.mu.y);
    events.sigma.y = sqrt(events.sn.y / (events.length));
  }
  events.push(event);
  xI = floor(map(event.x,0,1,0,resolution-1));
  yI = floor(map(event.y,0,1,0,resolution-1));
  eventMap[xI][yI]++;
  if(eventMap.maxD<eventMap[xI][yI]){
    eventMap.maxD = eventMap[xI][yI];
  }
}

function updateSurprise(){
  for(var i = 0;i<surpriseMap.length;i++){
    for(var j = 0;j<surpriseMap[i].length;j++){
      surpriseMap[i][j] = models[modeli].getS(i,j);
      if(surpriseMap[i][j]>surpriseMap.maxD){
        surpriseMap.maxD = surpriseMap[i][j];
      }
    }
  }
}

function windowResized(){
  resizeCanvas(windowWidth-20,windowHeight-20);
  background(220);
  drawStep();
}

function drawMap(aMap,x,y,w,h){
  h = h ? h : height;
  w = w ? w: width;
  x = x ? x: 0;
  y = y ? y: 0;
  var dx=w/resolution;
  var dy = h/resolution;
  var curx = 0;
  var cury = h-dy;
  push();
  translate(x,y);
  noStroke();
  for(var i = 0;i<aMap.length;i++){
    curx = 0;
    for(var j = 0;j<aMap[i].length;j++){
      fill(getColor(aMap[j][i],aMap.minD,aMap.maxD));
      rect(curx,cury,dx,dy);
      curx+=dx;
    }
    cury-=dy;
  }
  pop();
}

function getColor(value,minV,maxV){
  var mapI = map(value,minV,maxV,0,cbRed.length-1);
  if(!mapI){
    return cbRed[0];
  }
  var remainder = mapI - floor(mapI);
  //var mapColor = cbRed[0];
  var mapColor = cbRed[floor(mapI)];
  if(remainder>0){
    mapColor =  lerpColor(color(cbRed[floor(mapI)]),color(cbRed[floor(mapI)+1]),remainder);
  }
  return mapColor;
}

function gaussPDF(x,sigma){
  sigma = sigma ? sigma : 1;
  return (1/(sigma*sqrt(2*PI)))*exp(-1* sq(x) / (2*sq(sigma)));
}

function mousePressed(){
  var event = { x: constrain(randomGaussian(0.5,0.25),0,1), y: constrain(randomGaussian(0.5,0.25),0,1)};
  addEvent(event);
}

function keyPressed(){
  if(keyCode == LEFT_ARROW){
    modeli = (modeli-1);
    if(modeli<0){
      modeli+=models.length;
    }
    updateSurprise();
    drawStep();
  }

  if(keyCode == RIGHT_ARROW){
    modeli = (modeli+1) % models.length;
    updateSurprise();
    drawStep();
  }
}



