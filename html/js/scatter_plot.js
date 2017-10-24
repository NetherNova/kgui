padding = 72
canvas_width = 1080
canvas_height = 860

//var NAMESPACE = ''
//var RO_URL_PREFIX = ''
var vecProp = '<http://www.example.com/factory/knowledge_graph#vectorRepresentation>'

jsonValues = []

$('#query-viz-button').on('click', getVectorRepresentations);

function submitQuery(query, onSuccess) {
  var url = 'namespace/kb/sparql';
  var settings = {
     type: 'POST',
     //data: $('#viz-query-form').serialize(),
     data: query,
     headers: { 'Accept': 'application/sparql-results+json' },
     success: onSuccess,
     error: function (xhr, ajaxOptions, thrownError) {
       console.log(xhr);
       console.log(ajaxOptions);
       console.log(thrownError);
       $('#test_label').text("Error");
     }
  };
  console.log(url);
  console.log(settings);
  $.ajax(url, settings);
}

function submitQueryBox() {
    var query = 'query=' + $('#query-viz-box').val();
}

function getVectorRepresentations() {
    var query = 'query=' + 'SELECT ?s ?v WHERE {?s ' + vecProp + '?v . }';
    // fill jsonValues
    onSuccess = function (data) {
      bindings = data['result']['bindings']
      console.log(bindings);
      bindings.forEach(function( binding ) {
        console.log(binding['s']['value']);
        console.log(binding['v']['value']);
      } )
    }
    submitQuery(query, onSuccess);
}

path = 'embeddings/'
all_files = ['entity_embeddings0.csv', 'entity_embeddings5.csv',
             'entity_embeddings10.csv', 'entity_embeddings15.csv',
             'entity_embeddings20.csv', 'entity_embeddings25.csv',
           'entity_embeddings29.csv']
i = 0
num_files = all_files.length;

d3.select("#filter_button")
 .on("click", function() {
   d3.select()
   d3.csv(path + all_files[i], function(err, data) {
  d3.select("#step_label").html("Step: 0")
  var matrix = []
  var column_names = []
        column_names = d3.keys(data[0]).slice(0);
        data.forEach(function(row) {
          parsed = parseInt(row.uri)
          color = "darkblue"
          if(row.uri.includes("demonstrator") || row.uri.includes("DUL")) {
            color = "orange"
          }
          if(row.uri.includes("St?rung") || row.uri.includes("SM")) {
            color = "lightblue"
          }
          if(parsed != NaN && String(parsed).length == row.uri.length) {}
          else {
            matrix.push({id : row.id, x1: +row.x0, x2: +row.x1, uri : row.uri, col: color})
          }
        });

        d3.select("#exampleList").selectAll("option")
          .data(matrix, function(d) {return d.id})
          .enter()
          .append("option")
            .attr("value", function(d) {return d.uri})

            d3.select("#input_text")
              .attr("oninput", function(event) {
                d3.select("#exampleList").selectAll("option")
                  .data(matrix, function(d) {return d.id})
                  .enter()
                  .append("option")
                  .filter(function(d) {d.uri.includes(event.target.value)})
                  .attr("value", function(d) {return d.uri})
              })

        var xExtent = d3.extent(matrix, function(d) {
          return d.x0;
        });
        var yExtent = d3.extent(matrix, function(d) {
          return d.x1;
        });

        //var x1Scale = d3.scale.linear().domain(xExtent).range([0, 700]);
        /*
        var x1Scale = d3.scale.linear()
          .domain([d3.min(matrix, function(d) {return d.x0}), d3.max(matrix, function(d) {return d.x0})])
          .range([padding, canvas_width - padding * 2])
        var x2Scale = d3.scale.linear()
          .domain([d3.min(matrix, function(d) {return d.x1}), d3.max(matrix, function(d) {return d.x1})])
          .range([canvas_height - padding, padding])
*/
          var x1_min = d3.min(matrix, function(d) {return d.x1})
          var x1_max = d3.max(matrix, function(d) {return d.x1})

          var x2_min = d3.min(matrix, function(d) {return d.x2})
          var x2_max = d3.max(matrix, function(d) {return d.x2})

          var x1Scale = d3.scale.linear()
            .domain([x1_min, x1_max])
            .range([padding, canvas_width - padding * 2])
          var x2Scale = d3.scale.linear()
            .domain([x2_min, x2_max])
            .range([canvas_height - padding, padding])
        //var x2Scale = d3.scale.linear().domain(yExtent).range([0, 700]);
        // min max überprüfen
        var x1Axis = d3.svg.axis().scale(x1Scale)
          .orient("bottom").ticks(10).tickSize(2);
        d3.select("svg").append("g").attr("class", "x axis")
          .attr("transform", "translate(0," + (canvas_height - padding) + ")")
          .call(x1Axis)

        var x2Axis = d3.svg.axis().scale(x2Scale)
          .orient("left").ticks(10).tickSize(2);
        d3.select("svg").append("g").attr("class", "y axis")
          .attr("transform", "translate(" + padding + ", 0)")
          .call(x2Axis)

        var tooltip = d3.select("body")
          .append("div")
          .style("position", "absolute")
          .style("z-index", "10")
          .style("visibility", "hidden")
          .text("a simple tooltip")

        var elem = d3.select("svg").selectAll(".datapoint")
          .data(matrix, function(d) {return d.id}) // just to make sure ids and index actually match

        var elemEnter = elem.enter()
          .append("g")
          .attr("transform", function(d) {return "translate("+x1Scale(d.x1)+","+x2Scale(d.x2)+")"})
          .attr("class", "datapoint")

        var circle = elemEnter.append("circle")
            .attr("r", 5)
            .style("fill", function(d) {
              return d.col})
            .on("mouseover", function(d,i) {
              d3.selectAll("circle").style("fill", function(d) {
                return d.col });
              d3.select(this).style("fill", "darkred");
              return tooltip.style("visibility", "visible").text(d.uri);
            })
            .on("mousemove", function(d) {
              return tooltip.style("top",
                (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");
              })
            .on("mouseout", function(d) {
              d3.select(this).style("fill", d.col);
              d3.selectAll("circle").style("opacity", 1.0);
              return tooltip.style("visibility", "hidden");
            });

        d3.select("svg")
          .append("text")
          .attr("text-anchor", "middle")
          .attr("transform", "translate("+ (padding / 2) + "," +  (canvas_height / 2) + ")rotate(-90)")
          .text("Dim 1")

        d3.select("svg")
          .append("text")
          .attr("text-anchor", "middle")
          .attr("transform", "translate("+ (canvas_width / 2) + "," +  (canvas_height - (padding/3)) + ")")
          .text("Dim 2")

            /*
            .attr("cx", function(d, i) {
              return x1Scale(d.x1);
          }).attr("cy", function(d) {
              return x2Scale(d.x2);
          })
          */
          /*
          elemEnter.append("text")
          .attr("dx", function(d) {return -25})
          .text(function(d) {return d.id})
          .attr("opacity", 0);
          */
         d3.select("#step_button")
          .on("click", function() {
            if(i < num_files - 1) {
              i += 1
            }
            d3.select("#step_label").html("Step: " + i)
            d3.csv(path + all_files[i], function(err, data) {
                  //column_names = d3.keys(data[0]).slice(0);
                  matrix = []
                    data.forEach(function(row) {
                      parsed = parseInt(row.uri)
                      color = "darkblue"
                      if(row.uri.includes("demonstrator") || row.uri.includes("DUL")) {
                        color = "orange"
                      }
                      if(parsed != NaN && String(parsed).length == row.uri.length) {}
                      else {
                        matrix.push({id : row.id, x1: +row.x0, x2: +row.x1, uri : row.uri, col: color})
                      }
                    });

                    var x1_min = d3.min(matrix, function(d) {return d.x1})
                    var x1_max = d3.max(matrix, function(d) {return d.x1})

                    var x2_min = d3.min(matrix, function(d) {return d.x2})
                    var x2_max = d3.max(matrix, function(d) {return d.x2})

                    x1Scale.domain([x1_min, x1_max])
                      .range([padding, canvas_width - padding * 2])
                    x2Scale.domain([x2_min, x2_max])
                      .range([canvas_height - padding, padding])

                    var elem = d3.select("svg").selectAll(".datapoint")
                      .data(matrix, function(d) {return d.id}) // just to make sure ids and index actually match
                      .transition()
                      .duration(3000)
                      .each("start", function() {
                        // what to do when transitioning?
                      })
                      .delay(function(d, i) {
                        return 20; //nachgelagert... i / matrix.length * 2000;
                      })
                      .ease("linear")
                      .attr("transform", function(d) {
                        return "translate("+x1Scale(d.x1)+","+x2Scale(d.x2)+")"
                      })
                      .each("end", function() {
                        //d3.select(this)
                          //.transition()
                          //.duration(3000)
                      });

                      d3.select(".x.axis")
                        .transition()
                        .duration(3000)
                        .call(x1Axis);

                      d3.select(".y.axis")
                        .transition()
                        .duration(3000)
                        .call(x2Axis);
                    })
                })
});
});
