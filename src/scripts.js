var events = [];

var smap;
var kmap;
var hmap;
var qmap;

function setup(){
  pixelDensity(displayDensity());
  createCanvas(windowWidth-20,windowHeight-20);
  background(220);
  textSize(14);
  hmap = new Heatmap(1,1,width/2,height/2,21,21);
  qmap = new QuadMap(width/2,1,width/2,height/2,4);
  smap = new SedimentMap(1,height/2,width/2,height/2,20,0.1);
  kmap = new KDEMap(width/2,height/2,width/2,height/2,10);
  drawStep();
}

function windowResized(){
  resizeCanvas(windowWidth-20,windowHeight-20);
  background(220);
  hmap.w = width/2;
  hmap.h = height/2;
  qmap.w = width/2;
  qmap.x = width/2;
  qmap.h = height/2;
  smap.w = width/2;
  smap.y = height/2;
  smap.h = height/2;
  kmap.x = width/2;
  kmap.y = height/2;
  kmap.w = width/2;
  kmap.h = height/2;
  kmap.resample();
  drawStep();
}

function mousePressed(){
  eventStep();
}

function drawStep(){
  hmap.draw();
  qmap.draw();
  smap.draw();
  kmap.draw();
  fill(0);
  text("HeatMap",0,14);
  text("QuadMap",width-textWidth("QuadTree"),14);
  text("SedimentMap",0,height-14);
  text("KDEMap",width-textWidth("KDEMap"),height-14);
}

function timeStep(){
  background(220);
  for(var i = 0;i<events.length;i++){
    events[i].age++;
  }
  drawStep();
}

function eventStep(){
  event();
  timeStep();
}

function event(){
  var event = {};
  event.x = constrain(randomGaussian(0,0.25),-1,1);
  event.y = constrain(randomGaussian(0,0.25),-1,1);
  event.age = 0;
  events.push(event);
  hmap.push(event);
  qmap.push(event);
  smap.push(event);
  kmap.push(event);
}


function Heatmap(x,y,w,h,xbins,ybins){
    this.maxD = 0;
    this.makeBins = function(xbins,ybins){
        var bins = new Array(xbins);
        for(var i = 0;i<xbins;i++){
            bins[i] = new Array(ybins);
            for(var j = 0;j<ybins;j++){
                bins[i][j] = 0;
            }
        }
        return bins;
    };

    this.bins = this.makeBins(xbins,ybins);
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.draw = function(){
        var curx = 0, cury = 0,bw = this.w/this.bins.length,bh = this.h/this.bins[0].length;

        push();
        translate(this.x,this.y);
        fill(255);
        noStroke();
        rect(0,0,this.w,this.h);
        for(var i = 0;i<this.bins.length;i++){
            curx = 0;
            for(var j = 0;j<this.bins[i].length;j++){
                fill(255,0,0,255*this.bins[i][j]/this.maxD);
                rect(curx,cury,bw,bh);
                curx+= bw;
            }
            cury+= bh;
        }
        pop();
    };
    this.push = function(event){
        var yindex = event.y==-1 ? this.bins.length-1 :floor(map(-1*event.y,-1,1,0,this.bins.length));
        var xindex = event.x==1 ? this.bins[yindex].length-1 : floor(map(event.x,-1,1,0,this.bins[yindex].length));
        this.bins[yindex][xindex]++;
        if(this.bins[yindex][xindex]>this.maxD){
            this.maxD = this.bins[yindex][xindex];
        }
    };
}

function QuadTree(x,y,depth,maxDepth){
  this.depth = depth;
  this.events = [];
  this.touched = false;
  this.x = x;
  this.y = y;
  this.w = pow(0.5,depth);
  this.h = pow(0.5,depth);
  this.push = function(event){
        if(!this.touched || this.depth>=maxDepth){
          //console.log("placed at x"+this.x+",y"+this.y+",w"+this.w+",h"+this.h);
            this.events.push(event);
            if(this.events.length>qmap.maxD){
                qmap.maxD = this.events.length;
            }
            this.touched = true;
        }
        else{
          if(!this.children){
              this.children = [
                                 new QuadTree(this.x,this.y,this.depth+1,maxDepth),
                                 new QuadTree(this.x,this.y+(this.h/2),this.depth+1,maxDepth),
                                 new QuadTree(this.x+(this.w/2),this.y,this.depth+1,maxDepth),
                                 new QuadTree(this.x+(this.w/2),this.y+(this.h/2),this.depth+1,maxDepth),
                              ];
          }
          this.events.push(event);
          for(var i = 0;i<this.events.length;i++){
            var index = 0;
            if(this.events[i].x>=this.x+(this.w/2)){
              index = 2;
            }
            if(this.events[i].y>=this.y+(this.h/2)){
              index++;
            }
            this.children[index].push(this.events[i]);
          }
          this.events = [];
        }
    };
    this.draw = function(dx,dy,dw,dh){
        if(!this.children){
            push();
              fill(255,0,0,255*this.events.length/qmap.maxD);
              rect(dx,dy,dw,dh);
            pop();
        }
        else{
            this.children[0].draw(dx,dy,dw/2,dh/2);
            this.children[1].draw(dx,dy+(dh/2),dw/2,dh/2);
            this.children[2].draw(dx+(dw/2),dy,dw/2,dh/2);
            this.children[3].draw(dx+(dw/2),dy+(dh/2),dw/2,dh/2);
        }
    };
}//end QuadTree

function QuadMap(x,y,w,h,maxDepth){
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.maxD = 1;
    this.map = new QuadTree(0,0,0,maxDepth);
    this.draw = function(){
        push();
          translate(this.x,this.y);
          noStroke();
          fill(255);
          rect(0,0,this.w,this.h);
          this.map.draw(0,0,this.w,this.h);
        pop();
    };
    this.push = function(event){
        this.map.push({x: map(event.x,-1,1,0,1), y: map(-1*event.y,-1,1,0,1)});
    }
}//end QuadMap

function SedimentMap(x,y,w,h,r,epsilon){
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.r = r;
    this.epsilon = epsilon;
    this.events = [];
    this.draw = function(){
        push();
        translate(this.x,this.y);
        noStroke();
        fill(255);
        rect(0,0,this.w,this.h);
        fill(255,0,0,this.epsilon*255);
        for(var i = 0;i<this.events.length;i++){
            var xc = map(this.events[i].x,-1,1,0,this.w);
            var yc = map(this.events[i].y,-1,1,this.h,0);
            ellipse(xc,yc,this.r,this.r);
          //console.log(xc+","+yc);
        }
        pop();
    };
    this.push = function(event){
        this.events.push(event);
    }
}//end SedimentMap

function KDEMap(x,y,w,h,sigma){
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
  this.maxD = 0;
  this.sigma = sigma;
  this.pdf = function(x){
    var sigma = this.sigma ? this.sigma : 1;
    return (1/(sigma*sqrt(2*PI)))*exp(-1* sq(x) / (2*sq(sigma)));
  }
  this.events = [];
  this.push = function(event){
    this.events.push(event);
    if(!this.grid){
      this.grid = new Array(ceil(this.h));
      for(var i = 0;i<this.grid.length;i++){
        this.grid[i] = new Array(ceil(this.w));
        for(var j = 0;j<this.grid[i].length;j++){
          this.grid[i][j] = 0;
        }
      }
    }
    if(!this.kernel){
      this.kernel = new Array(6*this.sigma);
      var dist;
      for(var i = 0;i<this.kernel.length;i++){
        this.kernel[i] = new Array(6*this.sigma);
        for(var j = 0;j<this.kernel[i].length;j++){
          dist = sqrt(sq(j-(3*this.sigma)) + sq(i-(3*this.sigma)));
          this.kernel[i][j] = constrain(this.pdf(dist),0,1);
        }
      }
    }
    var xc = floor(map(event.x,-1,1,0,this.w));
    var yc = floor(map(event.y,-1,1,this.h,0));
    var xkc,ykc;
    for(var i = 0;i<this.kernel.length;i++){
      for(var j = 0;j<this.kernel[i].length;j++){
        ykc = floor(yc-(this.kernel.length/2)+i);
        xkc = floor(xc-(this.kernel[i].length/2)+j);
        if(ykc>0 && ykc<this.grid.length && xkc>0 && xkc<this.grid[yc].length){
          this.grid[ykc][xkc]+=this.kernel[i][j];
          if(this.grid[ykc][xkc]>this.maxD){
            this.maxD = this.grid[ykc][xkc];
          }
        }
      }
    }
  }
  this.resample = function(){
    if(this.w>0 && this.h>0){
      var oldevents = this.events;
      this.events = [];
      delete this.grid;
      for(var i = 0;i<oldevents.length;i++){
        this.push(oldevents[i]);
      }
    }
  }
  this.draw = function(){
    noStroke();
    fill(255);
    rect(this.x,this.y,this.w,this.h);
    if(this.grid){
      loadPixels();
      for(var i = 0;i<this.grid.length;i++){
        for(var j = 0;j<this.grid[i].length;j++){
          set(j+this.x,i+this.y,color(255,0,0,255*this.grid[i][j]/this.maxD));
        }
      }
      updatePixels();
    }
  }
  
}//end KDEMap

