d3.csv("data/public_schools_short.csv", d => ({
    lon: +d.LON,
    lat: +d.LAT
})).then(rawData => {
    const width   = 800,
          height  = 600,
          svg     = d3.select("svg"),
          kInput  = d3.select("#k"),
          resetBtn= d3.select("#reset"),
          nextBtn = d3.select("#next"),
          playBtn = d3.select("#play"),
          pauseBtn= d3.select("#pause");

    const projection = d3.geoAlbersUsa()
                         .translate([width/2, height/2])
                         .scale(1000);

    const data = rawData
      .map(d => {
        const xy = projection([d.lon, d.lat]);
        return xy ? { x: xy[0], y: xy[1] } : null;
      })
      .filter(d => d);

    let centroids,
        intervalId = null,
        intervalDelay = 1000;

    function init() {
      const k = +kInput.property("value");
      centroids = d3.shuffle(data)
                    .slice(0, k)
                    .map(d => ({ x: d.x, y: d.y }));
      draw();  
    }

    function step() {
      data.forEach(p => {
        let best = 0, bestDist = Infinity;
        centroids.forEach((c,i) => {
          const dx = p.x - c.x,
                dy = p.y - c.y,
                dist = dx*dx + dy*dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = i;
          }
        });
        p.cluster = best;
      });
      centroids = centroids.map((c,i) => {
        const members = data.filter(p => p.cluster === i);
        return {
          x: d3.mean(members, p => p.x),
          y: d3.mean(members, p => p.y)
        };
      });
      draw();
    }

    function draw() {
      const color = d3.schemeCategory10;
      svg.selectAll("circle.point")
         .data(data)
         .join("circle")
           .attr("class","point")
           .attr("r",3)
           .attr("cx", d=>d.x)
           .attr("cy", d=>d.y)
           .attr("fill", d=>color[d.cluster]);

      svg.selectAll("circle.centroid")
         .data(centroids)
         .join("circle")
           .attr("class","centroid")
           .attr("r",8)
           .attr("cx", d=>d.x)
           .attr("cy", d=>d.y)
           .attr("fill", (_,i)=>color[i]);
    }

    resetBtn.on("click", () => {
      stopAuto();
      init();
    });
    nextBtn.on("click", () => {
      stopAuto();
      step();
    });

    playBtn.on("click", () => {
      if (intervalId) return;
      intervalId = setInterval(step, intervalDelay);
      playBtn.attr("disabled", true);
      pauseBtn.attr("disabled", null);
    });
    pauseBtn.on("click", () => {
      stopAuto();
    });

    function stopAuto() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      playBtn.attr("disabled", null);
      pauseBtn.attr("disabled", true);
    }

    init();
});