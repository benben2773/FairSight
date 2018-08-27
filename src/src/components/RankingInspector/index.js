import React, { Component } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';
import ReactFauxDOM from 'react-faux-dom';
import { Steps} from 'antd';

import Generator from './Generator';
import InputSpaceView from './inputSpaceView';
import RankingView from './rankingView';
import IndividualFairnessView from './individualFairnessView';
import GroupFairnessView from './groupFairnessView';
import UtilityView from './utilityView';

import styles from './styles.scss';
import index from '../../index.css';
import gs from '../../config/_variables.scss'; // gs (=global style)

const Step = Steps.Step;

_.rename = function(obj, key, newKey) {
  
  if(_.includes(_.keys(obj), key)) {
    obj[newKey] = _.clone(obj[key], true);

    delete obj[key];
  }
  
  return obj;
};

function pairwise(list) {
  if (list.length < 2) { return []; }
  var first = list[0],
      rest  = list.slice(1),
      pairs = rest.map(function (x) { return [first, x]; });
  return pairs.concat(pairwise(rest));
}


class RankingInspector extends Component {
  constructor(props) {
    super(props);

    this.inputScale;
    this.outputScale;

    this.state = {
      selectedInstance: 1, // idx
      selectedRankingInterval: {
        start: 10,
        end: 20
      }
    }

    this.handleModelRunning = this.handleModelRunning.bind(this);
    this.handleMouseoverInstance = this.handleMouseoverInstance.bind(this);
  }

  combineData() {
    const dataInputCoords = this.props.inputCoords,
          dataOutput = this.props.output,
          idx = _.map(dataOutput, (d) => d.idx);

    let data = [];

    // Union 
    data = _.map(idx, (currentIdx) => {
        let inputObj = _.find(dataInputCoords, {'idx': currentIdx}),
            outputObj = _.find(dataOutput, {'idx': currentIdx});

        return {
          idx: currentIdx,
          group: inputObj.group,
          inputCoords: inputObj,
          output: outputObj
        }
      });

    return data;
  }
  // Calculate distortions of combinatorial pairs (For pairwise distortion plot)
  calculatePairwiseDiffs() {
    const data = this.combineData(),
          dataPairwiseInputDistances = this.props.pairwiseInputDistances,
          dataPairs = pairwise(data);   

    console.log('dataPairs: ', dataPairs);
    console.log('dataPairwiseInputDistances: ', dataPairwiseInputDistances)

    this.setScalesFromDataPairs(dataPairwiseInputDistances, dataPairs);

    let dataPairwiseDiffs = [];
    // Get difference between input space(from dataPairwiseInputDistances) and output space(from dataPairs.output.ranking)
    for(let i=0; i<dataPairs.length-1; i++){
      let diffInput = dataPairwiseInputDistances[i].input_dist,
          diffOutput = Math.abs(dataPairs[i][0].output.ranking - dataPairs[i][1].output.ranking),
          pair = 0;

      if((dataPairs[i][0].group === 1) && (dataPairs[i][1].group === 1))
        pair = 1;
      else if((dataPairs[i][0].group === 2) && (dataPairs[i][1].group === 2))
        pair = 2;
      else if(dataPairs[i][0].group !== dataPairs[i][1].group)
        pair = 3;

      dataPairwiseDiffs.push({
        idx1: dataPairs[i][0].idx,
        idx2: dataPairs[i][1].idx,
        pair: pair,
        diffInput: diffInput,
        diffOutput: diffOutput,
        scaledDiffInput: this.inputScale(diffInput),
        scaledDiffOutput: this.outputScale(diffOutput)
      });
    }

    return dataPairwiseDiffs;
  }

  // Calculate distortions of permutational pairs (For matrix view)
  calculatePermutationPairwiseDiffs() {
    const data = this.combineData(),
          dataPermutationInputDistances = this.props.permutationInputDistances;
    let dataPermutationDiffs = [], 
        input_idx = 0;

    console.log('dataPermutationInputDistances: ', dataPermutationInputDistances);
    _.forEach(data, (obj1) => {
        let row = [];
        _.forEach(data, (obj2) => {
          const diffInput = dataPermutationInputDistances[input_idx].input_dist,
                diffOutput = Math.abs(obj1.output.ranking - obj2.output.ranking);
          let pair = 0;

            if((obj1.group === 1) && (obj2.group === 1))
              pair = 1;
            else if((obj1.group === 2) && (obj2.group === 2))
              pair = 2;
            else if(obj1.group !== obj2.group)
              pair = 3;
          
          if(dataPermutationInputDistances[input_idx].idx1 !== obj1.idx)
            console.log('false for idx1')
          if(dataPermutationInputDistances[input_idx].idx2 !== obj2.idx)
            console.log('false for idx2')
          
          row.push({
            idx1: obj1.idx,
            idx2: obj2.idx,
            pair: pair,
            diffInput: diffInput,
            diffOutput: diffOutput,
            scaledDiffInput: this.inputScale(diffInput),
            scaledDiffOutput: this.outputScale(diffOutput),
            x1: obj1.output,
            x2: obj2.output
          });

          input_idx++;
        });
        dataPermutationDiffs.push(row);
    });

    console.log('dataPermutationDiffs: ', dataPermutationDiffs);

    return dataPermutationDiffs;
  }

  setScalesFromDataPairs(dataPairwiseInputDistances, dataPairs){
    this.inputScale = d3.scaleLinear()
        .domain(d3.extent(dataPairwiseInputDistances, (d) => d.input_dist))
        .range([0, 1]);
    this.outputScale = d3.scaleLinear()
        .domain(d3.extent(dataPairs, (d) => 
            Math.abs(d[0].output.ranking - d[1].output.ranking))
        )
        .range([0, 1]);
  }

  handleModelRunning(rankingInstance) {
    console.log('on the way up: ', rankingInstance);

    // Check all parameters so that we send all we need to run a model


    
    this.props.onRunningModel(rankingInstance)
  }

  handleMouseoverInstance(idx) {
    this.setState({
      selectedInstance: idx
    });
  }

  render() {
    var data = [1,2,3,4,5];

    // Data
    let selectedFeatures = this.props.selectedFeatures,
        selectedDataset = this.props.selectedDataset,
        sensitiveAttr = this.props.sensitiveAttr,
        output = this.props.output;
          
    let idx = _.map(selectedDataset, (d) => d.idx),
          x = _.map(selectedDataset, (d) => _.pick(d, [...selectedFeatures, 'idx'])),
          y = _.map(selectedDataset, (d) => _.pick(d, ['default', 'idx'])),
          groups = _.map(selectedDataset, (d) => _.pick(d, [sensitiveAttr, 'idx'])),
          rankings = _.map(output, (d) => _.pick(d, ['ranking', 'idx'])),
          scores = _.map(output, (d) => _.pick(d, ['score', 'idx']));

    // Merge multiple datasets (objects) as one object with all attributes together in each data point
    // x, y, diffs, diffsInPermutations
    
    const dataIndividualFairnessView = _.map(idx, (currentIdx) => {
            const xObj = _.find(x, {'idx': currentIdx}),
                  yObj = _.find(y, {'idx': currentIdx})['default'],
                  groupObj = _.find(groups, {'idx': currentIdx}),
                  rankingObj = _.find(rankings, {'idx': currentIdx}),
                  scoreObj = _.find(scores, {'idx': currentIdx});

            return {
              idx: currentIdx,
              x: xObj,
              y: yObj,
              group: groupObj[sensitiveAttr],
              ranking: rankingObj.ranking,
              score: scoreObj.score
            }
          }),

          dataGroupFairnessView = _.map(idx, (currentIdx) => {
            const xObj = _.find(x, {'idx': currentIdx}),
                  yObj = _.find(y, {'idx': currentIdx})['default'],
                  groupObj = _.find(groups, {'idx': currentIdx}),
                  rankingObj = _.find(rankings, {'idx': currentIdx}),
                  scoreObj = _.find(scores, {'idx': currentIdx});

            return {
              idx: currentIdx,
              x: xObj,
              y: yObj,
              group: groupObj[sensitiveAttr],
              ranking: rankingObj.ranking,
              score: scoreObj.score
            }
          });

    return (
      <div className={styles.RankingInspector}>
        <Steps progressDot current={2} className={styles.ProcessIndicator}>
          <Step title="Input" description="This is a description."/>
          <Step title="Distortion" description="Distortion generated"/>
          <Step title="Output" />
        </Steps>
        <Generator className={styles.Generator} 
                   wholeDataset={this.props.wholeDataset} 
                   onRunningModel={this.handleModelRunning}/>
        <RankingView topk={this.props.topk} ranking={this.props.ranking} output={this.props.output} />
        <InputSpaceView className={styles.InputSpaceView}
                        inputCoords={this.props.inputCoords}
                        selectedInstance={this.state.selectedInstance} 
                        onMouseoverInstance={this.handleMouseoverInstance} />
        <GroupFairnessView data={dataGroupFairnessView}
                           output={this.props.output} 
                           topk={this.props.topk} 
                           ranking={this.props.ranking} 
                           wholeRanking={this.props.wholeRanking} className={styles.GroupFairnessView} />
        <IndividualFairnessView data={dataIndividualFairnessView}
                                pairwiseDiffs={this.calculatePairwiseDiffs()}
                                pairwiseDiffsInPermutation={this.calculatePermutationPairwiseDiffs()}
                                />
        {/* <UtilityView ranking={this.props.ranking} wholeRanking={this.props.wholeRanking} className={styles.UtilityView} /> */}
      </div>
    );
  }
}

export default RankingInspector;
