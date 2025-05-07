d3.csv("data/public_schools_short.csv", d => ({
  lon: +d.LON,
  lat: +d.LAT
})).then(rawData => {
  const width   = 800,
        height  = 600,
        svg     = d3.select("svg"),
        
        // llyod buttons
        kInput  = d3.select("#k"),
        resetBtn= d3.select("#reset"),
        nextBtn = d3.select("#next"),
        playBtn = d3.select("#play"),
        pauseBtn= d3.select("#pause"),
        
        // Naive k-center buttons and svg
        naiveSvg = d3.select("#naive-svg"),
        kNaiveInput = d3.select("#k-naive"),
        resetNaiveBtn = d3.select("#reset-naive"),
        stepZeroNaiveBtn = d3.select("#step-zero-naive"),
        nextNaiveBtn = d3.select("#next-naive"),
        playNaiveBtn = d3.select("#play-naive"),
        pauseNaiveBtn = d3.select("#pause-naive");

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
    draw(svg, clusterData(data, centroids), centroids);  
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
    draw(svg, data, centroids);
  }

  function draw(svg,data,centroids, maxPair) {
    const color = d3.schemeCategory10;

    // remove and graph points
    svg.selectAll("circle.point").remove();
    svg.selectAll("circle.point")
       .data(data)
       .join("circle")
         .attr("class","point")
         .attr("r",3)
         .attr("cx", d=>d.x)
         .attr("cy", d=>d.y)
         .attr("fill", d=>color[d.cluster]);

    // remove and graph centers
    svg.selectAll("circle.centroid").remove();
    svg.selectAll("circle.centroid")
       .data(centroids)
       .join("circle")
         .attr("class","centroid")
         .attr("r",8)
         .attr("cx", d=>d.x)
         .attr("cy", d=>d.y)
         .attr("fill", (_,i)=>color[i]);

    // If maxpair exists,
    // remove and draw line between max pair,
    // highlighting the point
    svg.selectAll("line.max-pair").remove();
    // Remove old circle for maxPair point
    svg.selectAll("circle.max-pair-point").remove();

    // Draw line from maxPair.point to maxPair.center
    if (maxPair) {
      svg.append("line")
         .attr("class", "max-pair")
         .attr("x1", maxPair.point.x)
         .attr("y1", maxPair.point.y)
         .attr("x2", maxPair.center.x)
         .attr("y2", maxPair.center.y)
         .attr("stroke", "red")
         .attr("stroke-width", 2);

         // Bold and slightly enlarge the maxPair point
      svg.append("circle")
         .attr("class", "max-pair-point")
         .attr("r", 5) // Slightly larger radius for emphasis
         .attr("cx", maxPair.point.x)
         .attr("cy", maxPair.point.y)
         .attr("stroke", "black")
         .attr("stroke-width", 1); // Add a black stroke for better visibility
    }
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

  // Naive k-center algorithm
  let naiveCentroids
  // slice data to 50 points for naive algorithm
  let naiveData = data.slice(0, 50)

  // distance function
  function distance(a, b) {
    return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);
  }

  // get k values from input
  function getKNaive() {
    return +kNaiveInput.property("value");
  }

  let kNaive = getKNaive();

  // recursive fucntion to generate
  // an array of all k combinations of n points
  function kCombinations(array, k) {
    if (k === 0) return [[]];
    if (array.length === 0) return [];

    const [first, ...rest] = array;
    const withFirst = kCombinations(rest, k - 1).map(comb => [first, ...comb]);
    const withoutFirst = kCombinations(rest, k);
    return withFirst.concat(withoutFirst);
  }

  // max distance to nearest centroid
  // returns the max distance 
  // and the respective point, centroid pair
  function maxDistToCenters(small_data, centers) {
    let maxDistance = -Infinity;
    let maxPair = null;

    small_data.forEach(p => {
      let nearestCenter = null;
      let minDistance = Infinity;

      // find closest center to point p, and the distance to it (minDistance)
      centers.forEach(c => {
        const dist = distance(p, c);
        if (dist < minDistance) {
          minDistance = dist;
          nearestCenter = c;
        }
      });

      // if that closest center/distance is greater than the 
      // current maxDistance (of the entire set of points), update it
      if (minDistance > maxDistance) {
        maxDistance = minDistance;
        maxPair = { point: p, center: nearestCenter };
      }
    });

    return { maxDistance, maxPair }; // Return both the max distance and the respective point,center pair
  }

  // brute-force search
  function bruteForceSearch(small_data, k) {
    const allCombos = kCombinations(small_data, k);
    bestCenters = null;
    bestRadius = Infinity;

    for (const combo of allCombos) {
      const radius = maxDistToCenters(small_data, combo).maxDistance;
      if (radius < bestRadius) {
        bestRadius = radius;
        bestCenters = combo;
      }
    }

    console.log("Best centers found: ", bestCenters);

    // using best centers to assign clusters
    small_data.forEach(p => {
      let nearestCenterIndex = -1;
      let minDistance = Infinity;
      bestCenters.forEach((c, i) => {
        const dist = distance(p, c);
        if (dist < minDistance) {
          minDistance = dist;
          nearestCenterIndex = i;
        }
      });
      p.cluster = nearestCenterIndex; // Correctly assign cluster index
  });
    return bestCenters;
  }

  let stepIndex = 0;
  let allCombos = kCombinations(naiveData, kNaive);
  let bestRadius = Infinity;
  let bestCenters = null;
  let maxPair = null; // Initialize maxPair

        
  function initNaive() {
    kNaive = getKNaive();
    console.log("Initializing / Reseting Naive Map, k = ", kNaive);

    allCombos = kCombinations(naiveData, kNaive);
    bestCenters = bruteForceSearch(naiveData, kNaive);
    console.log("Best centers found: ", bestCenters);
    draw(naiveSvg, naiveData, bestCenters);

    // Update counters for n and k
    d3.select("#total-points-naive").text(naiveData.length); // Display total points
    d3.select("#num-clusters-naive").text(kNaive); // Display number of clusters

    // Reset the step display
    d3.select("#step-naive").text(`Algorithm Finished. Step: ${allCombos.length} 
    / ${allCombos.length}`); // Display algorithm finished and total steps
  }

  function clusterData(data, centers) {
    data.forEach(p => {
      let nearestCenterIndex = -1;
      let minDistance = Infinity;
      centers.forEach((c, i) => {
        const dist = distance(p, c);
        if (dist < minDistance) {
          minDistance = dist;
          nearestCenterIndex = i;
        }
      });
      p.cluster = nearestCenterIndex; // Correctly assign cluster index
    });

    return data;
  }

  function stepZeroNaive(){
    stepIndex = 0;
    kNaive = getKNaive();
    allCombos = kCombinations(naiveData, kNaive);
    bestRadius = Infinity;
    bestCenters = allCombos[stepIndex];
    draw(naiveSvg, naiveData,[]);
    
    // Update counters for n and k
    d3.select("#total-points-naive").text(naiveData.length); // Display total points
    d3.select("#num-clusters-naive").text(kNaive); // Display number of clusters

    // reset the step display 
    d3.select("#step-naive").text(`${stepIndex} / ${allCombos.length}`); // Display the current step index and total steps
    // Reset the current max distance display
    d3.select("#max-distance-naive").text(bestRadius.toFixed(2)); // Display the best radius found so far
    // Reset the best distance display
    d3.select("#best-distance-naive").text(bestRadius.toFixed(2)); // Display the best radius found so far
  }

  function stepNaive() {
    console.log("stepNaive called with i = ", stepIndex);
      const combo = allCombos[stepIndex];
      stepIndex++;
      const radius = maxDistToCenters(naiveData, combo).maxDistance;
      if (radius < bestRadius) {
        bestRadius = radius;
        bestCenters = combo;
      }
      console.log("Best centers found: ", bestCenters);

      // using best centers to assign clusters
      clusterData(naiveData, combo);

      maxPair = maxDistToCenters(naiveData, combo).maxPair; // Get the max pair for the current step
      draw(naiveSvg, naiveData, combo, maxPair); // Draw the current step with the max pair

      // Update the step display
      d3.select("#step-naive").text(`${stepIndex} / ${allCombos.length}`); // Display the current step index and total steps
      // Update the current max distance display
      d3.select("#max-distance-naive").text(radius.toFixed(2)); // Display the current max distance
      // Update the best distance display
      d3.select("#best-distance-naive").text(bestRadius.toFixed(2)); // Display the best radius found so far
      return bestCenters;
  }

  
  initNaive();
  
  resetNaiveBtn.on("click", initNaive);
  nextNaiveBtn.on("click", stepNaive);
  stepZeroNaiveBtn.on("click", stepZeroNaive);
});