var padding = 72,
    canvas_width,
    canvas_height,
    path = static_url + 'data/',
    entity_embedding_file = "entity_embeddings_low",
    relation_embedding_file = "relation_embeddings_low",
    topk_predictions_file = "topk_predictions_",
    i = 0,
    num_files = 6,
    linkColors = ["red", "blue", "green"],
    linkLabels = ["start", "middle", "end"],
    entityClassColors = d3.scale.category20(),
    relations,
    predicted_links,
    csrftoken,
    entityClasses,
    showEntityProps,
    matrix,
    x1Scale,
    x2Scale,
    x1Axis,
    x2Axis,
    brush,
    idleTimeout,
    idleDelay = 350,
    isZoomEnabled;


function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie != '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = jQuery.trim(cookies[i]);
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) == (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function start_experiment() {
    var url = '/ui/start_experiment/',
    settings = {
        type: 'POST',
        data: {
            'csrfmiddlewaretoken': csrftoken
        },
        success: function(data) {
            d3.selectAll("#filter_button, #step_button, #input_text, #entityType").attr('disabled', null);
            d3.select("#loader").style('display', 'none');
            var svg = d3.select("svg");
            svg.style('display', 'inline');
            setupViz();
            d3.select("#filter_button").on("click", highlightEntity);
        },
        error: function (xhr, ajaxOptions, thrownError) {
            console.log(xhr);
            console.log(ajaxOptions);
            console.log(thrownError);
            console.log("Error");
        }
    };
    $.ajax(url, settings);
    listenToServer();
}

function getRelationEmbeddings(i, callback) {
    d3.csv(path + relation_embedding_file + i + '.csv', function (err, data) {
        relations = data;
        callback();
    });
}

function getLinkPredictions(i) {
    d3.csv(path + topk_predictions_file + i + '.csv', function(err, data) {
        predicted_links = data;
        d3.select("#vizgroup").selectAll(".data-connector").remove();
    });
}

function getEntityEmbeddings(i, callback) {
    d3.csv(path + entity_embedding_file + i + '.csv', function(err, data) {
        if (err) {
            return;
        }
        d3.select("#step_label").html("Step: " + i);
        d3.select("#loader").style('display', 'none');

        matrix = [];
        entityClasses = ["Class"];

        data.forEach(function(row) {
            var uri_fragment, rowType;

            parsed = parseInt(row.uri);

            if (row.uri.indexOf('#') > -1) {
                uri_fragment = row.uri.split('#')[1];
            } else {
                uri_fragment = row.uri;
            }
            if (!uri_fragment.match(/\d+/g)) {
                rowType = 'Class';
            } else {
                rowType = row.class;
            }
            if (entityClasses.indexOf(rowType) == -1) {
                entityClasses.push(rowType);
            }

            color = entityClassColors(entityClasses.indexOf(rowType))
            if(row.uri.includes("demonstrator") || row.uri.includes("DUL")) {
                color = "orange";
            }
            if(row.uri.includes("St?rung") || row.uri.includes("SM")) {
                color = "lightblue";
            }
            if(parsed != NaN && String(parsed).length == row.uri.length) {}
            else {
                matrix.push({id : row.id, x1: +row.x0, x2: +row.x1, uri : row.uri, col: color, type: rowType, fragment: uri_fragment});
            }
        });
        callback(err, data);
    });
}

function highlightEntitiesByType(entityType) {
    //Hides link lines
    d3.selectAll("line[data-src]").style("display", "none");
    d3.selectAll("[class='info_tooltip']").style("display", "none");

    if(entityType == "All") {
        d3.selectAll("circle").style("opacity", 1.0).style("fill", function(d) {
            return d.col;
        });
    } else {
        d3.selectAll("circle").filter(function(d) {return d.type != entityType;}).style({
            "fill": "gray",
            "opacity": 0.1
        });
        d3.selectAll("circle").filter(function(d) {return d.type == entityType;}).style("opacity", 1.0)
        .style("fill", function(d) {
            return d.col;
        });
    }
}

function highlightEntity() {
    var selectedEntityName = d3.select("#input_text").property("value"),
        selectedEntity;
    if (!selectedEntityName)
        return;
    selectedEntityId = d3.select("option[value='" + selectedEntityName + "']").attr("label")
    selectedEntity = d3.select("[data-id='" + selectedEntityId + "']");
    showEntityProps(selectedEntity[0][0], selectedEntity.data()[0], selectedEntityId);
}

function setupViz() {
    canvas_height = parseFloat(d3.select("#vizgroup").style("height"));
    canvas_width = parseFloat(d3.select("#vizgroup").style("width"));

    getEntityEmbeddings(i, function(err, data) {

        var x1_min, x1_max, x2_min, x2_max;

        $.each(entityClasses, function(key, value) {
            $('#entityType')
                .append($("<option></option>")
                .attr("value", value)
                .text(value));
        });

        d3.select("#entityType")
            .on("change", function() {
                highlightEntitiesByType(this.value);
            });

        d3.select("#exampleList").selectAll("option")
            .data(matrix, function(d) {return d.id})
            .enter()
            .append("option")
            .attr("label", function(d) {return d.id})
            .attr("value", function(d) {return d.fragment});

        d3.select("#input_text")
            .attr("oninput", function(event) {
                d3.select("#exampleList").selectAll("option")
                    .data(matrix, function(d) {return d.id})
                    .enter()
                    .append("option")
                    .filter(function(d) {d.fragment.includes(event.target.value)});
            });

        x1Scale = d3.scale.linear().range([padding, canvas_width - padding * 2]);
        x2Scale = d3.scale.linear().range([canvas_height - padding, padding]);

        d3.select("#vizgroup .brush").remove()

        brush = d3.svg.brush()
                    .x(x1Scale).y(x2Scale)
                    .on("brushstart", brushstarted)
                    .on("brushend", brushended);

        var clip = d3.select("#vizgroup defs").append("svg:clipPath")
                        .attr("id", "clip")
                        .append("svg:rect")
                        .attr("id", "clip-rect")
                        .attr("x", padding)
                        .attr("y", padding)
                        .attr('width', canvas_width - padding * 3)
                        .attr('height', canvas_height - padding * 2);

        d3.select("#vizgroup #embedding").attr("clip-path", "url(#clip");

        function brushstarted() {
            d3.selectAll("circle").on("click", null);
        }

        function brushended() {
            var extent = brush.extent();

            if (extent[0][0] == extent[1][0] && extent[0][1] == extent[1][1]) {
                x1Scale.domain([x1_min, x1_max]);
                x2Scale.domain([x2_min, x2_max]);
            } else {
                x1Scale.domain([extent[0][0], extent[1][0]]); //min and max data Y values
                x2Scale.domain([extent[0][1], extent[1][1]]); //min and max data X values
            }

            transition_axis();
            transition_data();
            d3.select(".brush").call(brush.clear());

            d3.selectAll("circle").on("click", function(d, i) {
                showEntityProps(this, d, i)
            });
        }

        function transition_data() {
            d3.selectAll("circle")
                .data(matrix)
                .transition()
                .duration(2000)
                .attr("cx", function(d) {
                    return x1Scale(d.x1);
                })
                .attr("cy", function(d) {
                    return x2Scale(d.x2);
                });
        }

        function reset_axis() {
            x1_min = d3.min(matrix, function(d) {return d.x1});
            x1_max = d3.max(matrix, function(d) {return d.x1});
            x2_min = d3.min(matrix, function(d) {return d.x2});
            x2_max = d3.max(matrix, function(d) {return d.x2});

            x1Scale.domain([x1_min, x1_max]);
            x2Scale.domain([x2_min, x2_max]);
            transition_axis();
        }

        function transition_axis() {
            d3.select(".x.axis").transition().duration(2000).call(x1Axis);
            d3.select(".y.axis").transition().duration(2000).call(x2Axis);
            d3.selectAll(".axis line, .axis path").style({"fill": "none", "stroke": "black", "shape-rendering": "crispEdges"});
            d3.selectAll(".axis text").style({"font-family": "sans-serif", "font-size": "14px"});
        }

        function endAll(transition, callback) {
            if (typeof callback !== "function") throw new Error("Wrong callback in endAll");
            if (transition.size() === 0) { callback() }
            var n = 0;
            transition.each(function() { ++n; }) .each("end", function() { if (!--n) callback.apply(this, arguments); });
        }

        // min max überprüfen
        x1Axis = d3.svg.axis().scale(x1Scale)
            .orient("bottom").ticks(10).tickSize(2);
        d3.select("#vizgroup").append("g").attr("class", "x axis")
            .attr("transform", "translate(0," + (canvas_height - padding) + ")")
            .call(x1Axis);

        x2Axis = d3.svg.axis().scale(x2Scale)
            .orient("left").ticks(10).tickSize(2);
        d3.select("#vizgroup").append("g").attr("class", "y axis")
            .attr("transform", "translate(" + padding + ", 0)")
            .call(x2Axis);

        reset_axis();

        d3.select("#vizgroup").insert('g', '#embedding')
            .attr("class", "brush")
            .call(brush);

        d3.select(".brush").style({"pointer-events": "none"});

        var tooltip = d3.select("body")
            .append("div")
            .attr({"id": "tooltip", "class": "info_tooltip"})
            .text("a simple tooltip");

        var tooltip_top1 = d3.select("body")
            .append("div")
            .attr({"id": "tooltip_0", "class": "info_tooltip"})
            .text("a simple tooltip");

        var tooltip_top2 = d3.select("body")
            .append("div")
            .attr({"id": "tooltip_1", "class": "info_tooltip"})
            .text("a simple tooltip");

        var tooltip_top3 = d3.select("body")
            .append("div")
            .attr({"id": "tooltip_2", "class": "info_tooltip"})
            .text("a simple tooltip");

        d3.select("#vizgroup").on('click', function () {
            if (d3.event.target.nodeName != 'circle') {
                highlightEntitiesByType(d3.select("#entityType").property("value"));
            }
        });

        var elem = d3.select("#vizgroup #embedding").selectAll(".datapoint")
            .data(matrix, function(d) {return d.id}); // just to make sure ids and index actually match

        var highlightLinks = function (self, d) {
            predicted_links.filter(function(x) {return x.subject_predicate_object.split('_')[0] == d.id;}).forEach(function(link) {
                var temp = link.subject_predicate_object.split('_'),
                    srcId = temp[0],
                    relId = temp[1],
                    dstId = temp[2];
                var src = d3.select("[data-id='" + srcId + "']")[0][0],
                    dst = d3.select("[data-id='" + dstId + "']")[0][0];

                var x1 = src.getAttribute("cx"),
                    y1 = src.getAttribute("cy"),
                    x2 = dst.getAttribute("cx"),
                    y2 = dst.getAttribute("cy");

                var g = d3.select("#vizgroup").append("g")
                          .attr("transform", "translate("+x1+","+y1+")");

                g.append("line")
                    .style({"stroke": linkColors[link.rank], "display": "none", "pointer-events": "none"})
                    .attr({"x1": 0, "y1": 0, "x2": x2-x1, "y2": y2-y1, "class": "data-connector",
                    "data-src": srcId, "data-dst": dstId, "marker-end": "url(#arrow_" + linkColors[link.rank]+ ")"});

                d3.select("[data-id='" + srcId + "']").data()[0]["top" + link.rank] = {
                    'score': parseFloat(link.score).toFixed(2),
                    'relationType': relations[relId].uri.split('#')[1]
                };
            });
        };

        showEntityProps = function (self, d, i) {

            var outer_d = d;
            var entityLinks = d3.selectAll("line[data-src='" + d.id + "']");
            if(!entityLinks[0].length) {
                highlightLinks(this, d)
            }
            //Hides link lines
            d3.selectAll("line[data-src]").style("display", "none");

            d3.selectAll("circle").style({
                "fill": "gray",
                "opacity": 0.1
            });

            d3.select(self).style({
                "fill": "darkred",
                "opacity": 1.0
            });
            d3.selectAll("line[data-src='" + d.id + "']")
                .style("display", "inline")
                .each(function(d,i) {
                    d3.selectAll("circle[data-id='" + this.getAttribute("data-dst") + "']").style({
                        "fill": "lightcoral",
                        "opacity": 1.0
                    }).each(function(d) {
                        var position = this.getBoundingClientRect();
                        d3.select("[name='main_info_" + i + "']").attr("fill", linkColors[i]).text(outer_d['top'+i].relationType + ": " + d.fragment + " (" + outer_d['top'+i].score + ")");
                    });
                });

            var top_k = "<div style='font-size: 14px; color:" + linkColors[0] + "'>" + d.top0.relationType + ": " + d.top0.score + "</div>" +
                        "<div style='font-size: 14px; color:" + linkColors[1] + "'>" + d.top1.relationType + ": " + d.top1.score + "</div>" +
                        "<div style='font-size: 14px; color:" + linkColors[2] + "'>" + d.top2.relationType + ": " + d.top2.score + "</div>",
                position = self.getBoundingClientRect();

            d3.selectAll("[name^='main_info']").style("display", "block");
            d3.select("[name='main_info']").text(d.fragment);

            return tooltip.style({
                "display": "block",
                "top": (position.y-15) + "px",
                "left": (position.x+15) + "px"
            }).html(d.fragment);
        };

        var circle = elem.enter().append("circle")
            .attr("r", 5)
            .attr("class", "datapoint")
            .attr("cx", function(d) {
                return x1Scale(d.x1);
            })
            .attr("cy", function(d) {
                return x2Scale(d.x2);
            })
            .attr("data-id", function(d) {
                return d.id;
            })
            .style("fill", function(d) {
                return d.col;
            })
            .on("click", function(d, i) {
                showEntityProps(this, d, i)
            });

        d3.select("#vizgroup")
            .append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "translate("+ (padding / 2) + "," +  (canvas_height / 2) + ")rotate(-90)")
            .style({"font-family": "sans-serif", "font-size": "16px", "font-weight": "bold"})
            .text("Dimension 1");

        d3.select("#vizgroup")
            .append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "translate("+ (canvas_width / 2) + "," +  (canvas_height - (padding/3)) + ")")
            .style({"font-family": "sans-serif", "font-size": "16px", "font-weight": "bold"})
            .text("Dimension 2");

        getRelationEmbeddings(i, function () {
            getLinkPredictions(i);
        });

        d3.select("#step_button")
            .on("click", function() {
                if(i < num_files - 1) {
                    i += 1;

                    d3.select("#loader").style('display', 'block');

                    var url = 'embedding/',
                        settings = {
                            type: 'POST',
                            data: {
                                'csrfmiddlewaretoken': csrftoken,
                                'iteration': i
                            },
                            success: function(data) {

                                getEntityEmbeddings(i, function(err, data) {
                                    reset_axis();

                                    var elem = d3.select("#vizgroup").selectAll(".datapoint")
                                        .data(matrix, function(d) {return d.id}) // just to make sure ids and index actually match
                                        .transition()
                                        .duration(2000)
                                        .each("start", function() {
                                        // what to do when transitioning?
                                        })
                                        .delay(function(d, i) {
                                          return 20; //nachgelagert... i / matrix.length * 2000;
                                        })
                                        .ease("linear")
                                        .attr("cx", function(d) {return x1Scale(d.x1);})
                                        .attr("cy", function(d) {return x2Scale(d.x2);})
                                        .call(endAll, function() {
                                            getRelationEmbeddings(i, function () {
                                                // Invoke the function to get the link predictions after all the
                                                // elements have been transitioned according to the next step embedding
                                                getLinkPredictions(i);
                                            });
                                        });
                                });
                            },
                            error: function(xhr, ajaxOptions, thrownError) {
                                console.log(xhr);
                                console.log(ajaxOptions);
                                console.log(thrownError);
                            }
                        };
                    $.ajax(url, settings);
                    listenToServer();
                } else {
                    console.log("No more steps to loop.");
                }
                return;
            });

        d3.select("#reset").on("click", function () {
            reset_axis();
            transition_data();
        });

        d3.select("#zoom").on("click", function () {
            isZoomEnabled = !isZoomEnabled;
            d3.select(".brush").style("pointer-events", isZoomEnabled ? "all" : "none");
        });

        d3.select("#save").on("click", function () {
            function exportSvg() {
                var svgData = new XMLSerializer().serializeToString(document.querySelector("svg"));

                var canvas = document.createElement("canvas");
                var context = canvas.getContext("2d");
                var dataUri = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svgData);
                var img = document.createElement("img");
                img.onload = function() {
                    context.drawImage( img, 0, 0 );
                    try {
                        // Try to initiate a download of the image
                        var a = document.createElement("a");
                        a.download = "kg_embedding.svg";
                        a.href = dataUri;
                        document.querySelector("body").appendChild(a);
                        a.click();
                        document.querySelector("body").removeChild(a);
                    } catch (ex) {
                        // If downloading not possible (as in IE due to canvas.toDataURL() security issue)
                        // then display image for saving via right-click
                        var imgPreview = document.createElement("div");
                        imgPreview.appendChild(img);
                        document.querySelector("body").appendChild(imgPreview);
                    }
                };
                img.src = dataUri;
            }
            exportSvg();
        });
    });
}

function listenToServer() {
    var eventSource = new EventSource('status/');
    eventSource.onmessage = function(event) {
        $("#status").text(event.data);
        if(event.data == "Done.")
            event.target.close();
    };
}

csrftoken = getCookie('csrftoken');

$(document).ready(function () {
    start_experiment();
});
