import React from 'react';
import * as d3 from 'd3';
import _ from 'lodash';
import { Bar } from '@vx/shape';
import { genRandomNormalPoints } from '@vx/mock-data';
import { scaleLinear } from '@vx/scale';
import { Group } from '@vx/group';
import { AxisLeft, AxisBottom } from '@vx/axis';
import { BoxBrush, withBrush, getCoordsFromEvent, constrainToRegion } from '@vx/brush';
import { Motion, spring } from 'react-motion';

const points = genRandomNormalPoints();

class WholeRankingChart extends React.Component {
  constructor(props) {
    super(props);
    const { data, width, height, margin } = props;

    this.layout = {
      wholeRankingchart: {
        width: 1000,
        height: 50
      }
    }

    this.extent = {
      x0: margin.left,
      x1: width - margin.left,
      y0: margin.top,
      y1: height - margin.top
    };

    this.initialDomain = {
      x: d3.range(100),
      y: d3.extent(data.instances, (d) => d.score)
    };

    this.xScale = scaleLinear({
      domain: this.initialDomain.x,
      range: [0, 800] //[0, width - margin.left - margin.right],
    });

    this.yScale = scaleLinear({
      domain: this.initialDomain.y,
      range: [30, 0], //[height - margin.top - margin.bottom, 0],
      clamp: true
    });

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  scaleReset() {
    const { xScale, yScale, initialDomain } = this;
    xScale.domain(initialDomain.x);
    yScale.domain(initialDomain.y);
  }

  handleMouseDown(event) {
    const { onBrushStart } = this.props;
    const { extent: region } = this;
    const { x, y } = getCoordsFromEvent(this.svg, event);
    onBrushStart(constrainToRegion({ region, x, y }));
  }

  handleMouseMove(event) {
    const { brush, onBrushDrag, updateBrush } = this.props;
    // only update the brush region if we're dragging
    if (!brush.isBrushing) return;
    const { extent: region } = this;

    console.log('in handleMouseMove: ', this);

    const { x, y } = getCoordsFromEvent(this.svg, event);
    onBrushDrag(constrainToRegion({ region, x, y }));
  }

  handleMouseUp(event) {
    const { brush, onBrushEnd, onBrushReset } = this.props;
    const { extent: region } = this;

    console.log('in handleMouseMove: ', this);

    if (brush.end) {
      const { x, y } = getCoordsFromEvent(this.svg, event);
      onBrushEnd(constrainToRegion({ region, x, y }));
      return;
    }
    onBrushReset(event);
    this.scaleReset();
  }

  render() {
    const { data, width, height, brush, margin } = this.props;
    const { xScale, yScale } = this;
    const { instances } = data;
    const dataBin = d3.histogram()
            .domain([0, 100])
            .thresholds(d3.range(0, 100, 1))
            (_.map(instances, (d) => d.score));
    const topInstances = [...instances].sort((a, b) => 
              d3.descending(a.score, b.score)
            ).slice(0, 100);

    const xMax = width - margin.left - margin.right;
    const yMax = height - margin.top - margin.bottom;

    this.xScale.domain([100, 0]);
    this.yScale.domain(d3.extent(dataBin, (d) => typeof(d.length) !== 'undefined' ? d.length : 0));
                       
    if (brush.domain) {
      const { domain } = brush;
      const { x0, x1, y0, y1 } = domain;
      const invertedDomain = [x0, x1].map((d) => xScale.customInvert(d));

      this.props.onSelectedRankingInterval({ from: invertedDomain[0], to: invertedDomain[1] });
    }

    xScale.customInvert = (function(){
        var domain = xScale.domain()
        var range = xScale.range()
        var scale = d3.scaleQuantize().domain(range).range(domain)
    
        return function(x){
            return scale(x)
        }
    })()

    return (
      <svg
        ref={c => {
          this.svg = c;
        }}
        width={this.layout.wholeRankingchart.width}
        height={this.layout.wholeRankingchart.height}
        margin={10}
        onMouseDown={this.handleMouseDown}
        onMouseMove={this.handleMouseMove}
        onMouseUp={this.handleMouseUp}
      >
        <AxisBottom
          scale={xScale}
          top={30}
          left={0 + 10}
          label={''}
          stroke={'#1b1a1e'}
          tickTextFill={'#1b1a1e'}
        />
        <Group 
          top={margin.top} 
          left={margin.left + 10}
        >
          {dataBin.map(bin => {
            return (
              <Bar
                width={6}
                height={30 - yScale(bin.length)}
                x={xScale(bin.x0)}
                y={yScale(bin.length)}
                fill={'gray'}
                stroke={'black'}
                strokeWidth={1}
              />
            );
          })}
        </Group>
        <BoxBrush brush={brush} />
      </svg>
    );
  }
}

export default withBrush(WholeRankingChart);