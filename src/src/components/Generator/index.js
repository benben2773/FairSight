import React, { Component } from 'react';
import _ from 'lodash';
import * as d3 from 'd3';
import ReactFauxDOM from 'react-faux-dom';
import d3tooltip from 'd3-tooltip';
import {
  FormGroup,
  FormText,
  Input,
  Label,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from 'reactstrap';
import {
  Button,
  Alert,
  TreeSelect,
  Slider,
  InputNumber,
  Icon,
  Table,
  Badge,
  Radio,
  Spin
} from 'antd';
import { BeatLoader } from 'react-spinners';

import styles from './styles.scss';
import index from '../../index.css';
import gs from '../../config/_variables.scss';

const TreeNode = TreeSelect.TreeNode;
const tooltip = d3tooltip(d3);

class Generator extends Component {
  constructor(props) {
    super(props);

    this.state = {
      corrBetweenSensitiveAndAllFeatures: {},
      sensitiveAttrDropdownOpen: false,
      methodDropdownOpen: false,
      targetDropdownOpen: false,
      dataset: {},
      ranking: {},
      topkInput: 0,
      fq: {
        isFairness: true
      },
      isMouseoveredRect: false,
      mouseoveredRect: 0,
      tooltipLeft: 10
    };

    this.layout = {
      featureTable: {
        corr: {
          width: 60,
          height: 60,
          marginBtn: 5
        }
      }
    };

    this.toggleSensitiveAttrDropdown = this.toggleSensitiveAttrDropdown.bind(
      this
    );
    this.toggleTargetDropdown = this.toggleTargetDropdown.bind(this);
    this.toggleMethodDropdown = this.toggleMethodDropdown.bind(this);
    this.handleMethodSelected = this.handleMethodSelected.bind(this);
    this.handleClickSensitiveAttr = this.handleClickSensitiveAttr.bind(this);
    this.handleClickProtectedGroup = this.handleClickProtectedGroup.bind(this);
    this.handleSelectFeatures = this.handleSelectFeatures.bind(this);
    this.handleClickTarget = this.handleClickTarget.bind(this);
    this.handleClickMethod = this.handleClickMethod.bind(this);
    this.handleClickRun = this.handleClickRun.bind(this);
    this.handleClickGroup = this.handleClickGroup.bind(this);
  }

  shouldComponentUpdate(nextProps, nextState) {
    const methodsPropsChange = this.props.methods !== nextProps.methods;
    const rankingInstancePropsChange =
      this.props.rankingInstance !== nextProps.rankingInstance;
    const topkPropsChange = this.props.topk !== nextProps.topk;
    const nPropsChange = this.props.n !== nextProps.n;
    const sensitiveAttrDropdownOpenChange =
      this.state.sensitiveAttrDropdownOpen !==
      nextState.sensitiveAttrDropdownOpen;
    const targetDropdownOpenChange =
      this.state.targetDropdownOpen !== nextState.targetDropdownOpen;
    const methodDropdownOpenChange =
      this.state.methodDropdownOpen !== nextState.methodDropdownOpen;

    return (
      methodsPropsChange ||
      rankingInstancePropsChange ||
      topkPropsChange ||
      nPropsChange ||
      sensitiveAttrDropdownOpenChange ||
      targetDropdownOpenChange ||
      methodDropdownOpenChange
    );
  }

  componentDidMount() {
    const { rankingInstance } = this.props,
      { sensitiveAttr, features } = rankingInstance;

    if (features.filter(d => d.name === sensitiveAttr.name).length === 0) {
      d3.select('#buttonUnawareness').classed('method_selected', true);
    }

    d3.select('#buttonMethodLogisticRegression').classed(
      'method_selected',
      true
    );
  }

  componentWillUpdate(nextProps, nextState) {
    if (
      nextProps.rankingInstance.method.name !==
      this.props.rankingInstance.method.name
    ) {
      d3.select(
        '#buttonMethod' +
          this.props.rankingInstance.method.name.replace(/ /g, '')
      ).classed('method_selected', false);
      d3.select(
        '#buttonMethod' +
          nextProps.rankingInstance.method.name.replace(/ /g, '')
      ).classed('method_selected', true);
    }
    if (nextProps.rankingInstance.isReranking) {
      d3.select('#buttonReranking').classed('method_selected', true);
    } else {
      d3.select('#buttonReranking').classed('method_selected', false);
    }
  }

  componentDidUpdate() {}

  toggleSensitiveAttrDropdown() {
    this.setState({
      sensitiveAttrDropdownOpen: !this.state.sensitiveAttrDropdownOpen
    });
  }

  toggleTargetDropdown() {
    this.setState({
      targetDropdownOpen: !this.state.targetDropdownOpen
    });
  }

  handleMethodSelected(e) {
    const { method, isReranking } = this.props.rankingInstance;
    const selectedMethod = e.target.value;

    if (selectedMethod !== method.name) {
      this.props.onSelectRankingInstanceOptions({ method: selectedMethod });
    }
    if (selectedMethod === 'Reranking') {
      if (isReranking === false) {
        this.props.onSelectRankingInstanceOptions({
          isReranking: true,
          method: method.name
        });
      } else {
        this.props.onSelectRankingInstanceOptions({
          isReranking: false,
          method: method.name
        });
      }
    }
  }

  toggleMethodDropdown() {
    this.setState({
      methodDropdownOpen: !this.state.methodDropdownOpen
    });
  }

  handleClickSensitiveAttr(e) {
    const selectedSensitiveAttr = e.target.value;
    this.props.onSelectRankingInstanceOptions({
      sensitiveAttr: selectedSensitiveAttr
    });
  }

  handleClickProtectedGroup(e) {
    const selectedProtectedGroup = e.target.value,
      groups = this.props.rankingInstance.sensitiveAttr.range;
    this.props.onSelectProtectedGroup({
      protectedGroup: selectedProtectedGroup,
      nonProtectedGroup: groups.filter(
        group => group !== selectedProtectedGroup
      )[0]
    });
  }

  handleClickTarget(e) {
    const selectedTarget = e.target.value;
    this.props.onSelectRankingInstanceOptions({ target: selectedTarget });
  }

  handleSelectFeatures(selectedFeatures) {
    this.props.onSelectRankingInstanceOptions({ features: selectedFeatures });
  }

  handleClickMethod(e) {
    const selectedMethod = e.target.value;
    this.props.onSelectRankingInstanceOptions({ method: selectedMethod });
  }

  handleClickRun() {
    this.props.onRunningModel();
  }

  handleClickGroup() {}

  handleMouseoveredRect(idx) {
    this.setState({
      isMouseoveredRect: true,
      mouseoveredRect: idx
    });
  }

  onChange = value => {
    this.setState({ value });
  };

  renderSelectProtectedGroup() {
    const { rankingInstance } = this.props,
      { sensitiveAttr } = rankingInstance;
    const sensitiveAttrName = sensitiveAttr.name,
      group1 = sensitiveAttr.range[0],
      group2 = sensitiveAttr.range[1],
      protectedGroup = sensitiveAttr.protectedGroup,
      nonProtectedGroup = sensitiveAttr.nonProtectedGroup;

    return (
      <div className={styles.selectProtectedGroupWrapper}>
        <div className={styles.selectProtectedGroupTitle}>
          Select protected group
        </div>
        <Radio.Group
          className={styles.protectedGroupRadioButton}
          onChange={this.handleClickProtectedGroup}
          defaultValue={group2}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value={group1}>{group1}</Radio.Button>
          <Radio.Button value={group2}>{group2}</Radio.Button>
        </Radio.Group>
        <div className={styles.selectProtectedGroup}>
          <div className={styles.group2}>
            <Badge onClick={this.handleClickGroup} status="error" />
            {protectedGroup + '(50%)'}
          </div>
          <div className={styles.group1}>
            <Badge status="default" />
            {nonProtectedGroup + '(50%)'}
          </div>
        </div>
      </div>
    );
  }

  renderSensitiveAttrSelections() {
    const { features } = this.props;
    const sensitiveAttrs = [
      { name: 'sex', type: 'categorical', range: ['Men', 'Women'] },
      { name: 'age_in_years', type: 'continuous', range: 'continuous' },
      {
        name: 'age>25',
        type: 'categorical',
        range: ['age_over_25', 'age_less_25']
      },
      {
        name: 'age>35',
        type: 'categorical',
        range: ['age_over_35', 'age_less_35']
      }
    ];

    return sensitiveAttrs.map((feature, idx) => (
      <DropdownItem
        key={idx}
        value={feature.name}
        onClick={this.handleClickSensitiveAttr}
      >
        {feature.name}
      </DropdownItem>
    ));
  }

  renderTargetSelections() {
    const { features } = this.props;

    return features.map((feature, idx) => (
      <DropdownItem
        key={idx}
        value={feature.name}
        onClick={this.handleClickTarget}
      >
        {feature.name}
      </DropdownItem>
    ));
  }

  renderFeatureSelections() {
    const { features } = this.props;

    return features.map((feature, idx) => (
      <TreeNode value={feature.name} title={feature.name} key={idx} />
    ));
  }

  renderFeatureSelectionsForTable() {
    const _self = this;
    const {
        dataset,
        features,
        numericalFeatures,
        ordinalFeatures,
        corrBtnSensitiveAndAllFeatures,
        rankingInstance
      } = this.props,
      { sensitiveAttr } = rankingInstance,
      wholeFeatures = Object.keys(dataset[0]).filter(d => d !== 'idx'),
      sensitiveAttrName = sensitiveAttr.name;

    const groupInstances1 = dataset.filter(d => d[sensitiveAttrName] === 0),
      groupInstances2 = dataset.filter(d => d[sensitiveAttrName] === 1);

    return features.map((feature, idx) => {
      const { name, type, range } = feature;
      let featureType;

      if (type === 'categorical') {
        if (range.length == 2) {
          featureType = 'categorical';
        } else {
          featureType = 'ordinal';
        }
      } else if (type === 'continuous') {
        featureType = 'continuous';
      }

      return {
        key: idx + 1,
        feature: name.replace(/_/g, ' '),
        corr:
          name !== sensitiveAttr.name
            ? Math.round(corrBtnSensitiveAndAllFeatures[name] * 100) / 100
            : 'NaN',
        distribution:
          featureType === 'continuous'
            ? _self.renderCorrPlotWithSensitiveAttrForNumericalVars(
                feature,
                groupInstances1,
                groupInstances2
              )
            : featureType === 'ordinal'
            ? _self.renderCorrPlotWithSensitiveAttrForOrdinalVars(
                feature,
                groupInstances1,
                groupInstances2
              )
            : _self.renderCorrPlotWithSensitiveAttrForCategoricalVars(feature)
      };
    });
  }

  renderMethodSelectionsForTable() {
    const _self = this;
    const { methods } = this.props;

    return methods.map(method => {
      const { name, spec } = method,
        { Q1, Q2, Q3, Q4 } = spec;

      return {
        method: name,
        Q1: Q1,
        Q2: Q2,
        Q3: Q3,
        Q4: Q4
      };
    });
  }

  renderCorrPlotWithSensitiveAttrForNumericalVars(
    feature,
    groupInstances1,
    groupInstances2
  ) {
    const _self = this;

    const { rankingInstance, dataset } = this.props,
      { instances } = rankingInstance,
      { name, type, range } = feature;

    const featureValues = dataset.map(d => d[name]),
      featureValuesForGroup1 = groupInstances1.map(d => d[name]),
      featureValuesForGroup2 = groupInstances2.map(d => d[name]),
      nonProtectedGroupLength = featureValuesForGroup1.length,
      protectedGroupLength = featureValuesForGroup2.length;

    const nBins = 10,
      min = d3.min(featureValues),
      max = d3.max(featureValues),
      step = Math.floor((max - min) / nBins),
      thresholds = d3.range(min, max, step);

    const dataBin = d3
        .histogram()
        .domain(range)
        .thresholds(thresholds)(featureValues),
      dataBinGroup1 = d3
        .histogram()
        .domain(range)
        .value(d => d[name])
        .thresholds(thresholds)(groupInstances1),
      dataBinGroup2 = d3
        .histogram()
        .domain(range)
        .value(d => d[name])
        .thresholds(thresholds)(groupInstances2);

    const svgCorrPlot = new ReactFauxDOM.Element('svg');

    svgCorrPlot.setAttribute('width', _self.layout.featureTable.corr.width);
    svgCorrPlot.setAttribute('height', _self.layout.featureTable.corr.height);
    svgCorrPlot.setAttribute('0 0 100 100');
    svgCorrPlot.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgCorrPlot.setAttribute('class', 'svg_corr_plot_' + name);

    // Both groups share the same x and y scale
    const xScale = d3
        .scaleBand()
        .domain(dataBin.map(d => d.x0))
        .range([0, _self.layout.featureTable.corr.width]),
      yScale = d3
        .scaleLinear()
        .domain(d3.extent(dataBin, d => d.length))
        .range([_self.layout.featureTable.corr.height, 0]);

    let groupHistogramBar1, groupHistogramBar2;

    groupHistogramBar1 = d3
      .select(svgCorrPlot)
      .selectAll('.g_corr_plot_group1_' + name)
      .data(dataBinGroup1)
      .enter()
      .append('g')
      .attr('class', (d, i) => 'g_corr_plot_group1_' + name)
      .attr('transform', function(d) {
        return 'translate(' + xScale(d.x0) + ',' + yScale(d.length) + ')';
      });

    groupHistogramBar1
      .append('rect')
      .attr('class', 'tooltip_' + name)
      .attr('x', 10)
      .attr('y', 10)
      .attr('width', 10 - 0.5) // 0.5 = padding
      .attr('height', 10)
      .style('fill', 'none')
      .style('opacity', 0);

    groupHistogramBar1
      .append('rect')
      .attr('x', 0)
      .attr('width', xScale.bandwidth() - 0.5)
      .attr(
        'height',
        d => _self.layout.featureTable.corr.height - yScale(d.length)
      )
      .style('fill', gs.groupColor1)
      .style('stroke', 'none')
      .style('opacity', 0.5)
      .style('shape-rendering', 'crispEdge')
      .style('stroke-width', 0.5)
      .on('mouseover', (d, i) => {
        tooltip.html(
          '<div>Group: Men</div>' +
            '<div>Range: ' +
            d.x0 +
            '-' +
            d.x1 +
            '</div>' +
            '<div>Prob: ' +
            Math.round((d.length / nonProtectedGroupLength) * 100) / 100 +
            '</div>'
        );
        tooltip.show();
      })
      .on('mouseout', (d, i) => {
        tooltip.hide();
      });

    groupHistogramBar2 = d3
      .select(svgCorrPlot)
      .selectAll('.g_corr_plot_group2_' + name)
      .data(dataBinGroup2)
      .enter()
      .append('g')
      .attr('class', 'g_corr_plot_group2_' + name)
      .attr('transform', function(d) {
        return 'translate(' + xScale(d.x0) + ',' + yScale(d.length) + ')';
      });

    groupHistogramBar2
      .append('rect')
      .attr('x', 0)
      .attr('width', xScale.bandwidth())
      .attr(
        'height',
        d => _self.layout.featureTable.corr.height - yScale(d.length)
      )
      .style('fill', '#fd5d00')
      .style('stroke', 'none')
      .style('opacity', 0.5)
      .style('shape-rendering', 'crispEdge')
      .style('stroke-width', 0.5)
      .on('mouseover', (d, i) => {
        tooltip.html(
          '<div>Group: Women</div>' +
            '<div>Range: ' +
            d.x0 +
            '-' +
            d.x1 +
            '</div>' +
            '<div>Prob: ' +
            Math.round((d.length / nonProtectedGroupLength) * 100) / 100 +
            '</div>'
        );
        tooltip.show();
      })
      .on('mouseout', (d, i) => {
        tooltip.hide();
      });

    return (
      <div className={styles.corrPlotWrapper}>{svgCorrPlot.toReact()}</div>
    );
  }

  renderCorrPlotWithSensitiveAttrForOrdinalVars(feature) {
    const _self = this;

    const { dataset, rankingInstance } = this.props,
      { instances, sensitiveAttr } = rankingInstance,
      { name, type, range, label } = feature,
      { protectedGroup, nonProtectedGroup } = sensitiveAttr,
      sensitiveAttrName = sensitiveAttr.name,
      sensitiveAttrRange = sensitiveAttr.range;

    const svgCorrPlot = new ReactFauxDOM.Element('svg');

    svgCorrPlot.setAttribute('width', _self.layout.featureTable.corr.width);
    svgCorrPlot.setAttribute('height', _self.layout.featureTable.corr.height);
    svgCorrPlot.setAttribute('0 0 100 100');
    svgCorrPlot.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgCorrPlot.setAttribute('class', 'svg_corr_plot_' + name);

    let protectedGroupBinary, nonProtectedGroupBinary;

    if (sensitiveAttrRange[0] === protectedGroup) {
      // Find the corresponding 0 or 1 to protected or non-protected group string
      protectedGroupBinary = 0;
      nonProtectedGroupBinary = 1;
    } else {
      protectedGroupBinary = 1;
      nonProtectedGroupBinary = 0;
    }

    const featureValues = dataset.map(d => d[name]),
      instancesForFeatureValues2 = dataset.filter(d => d[name] === 1),
      featureValuesForProtectedGroup = dataset
        .filter(d => d[sensitiveAttrName] === protectedGroupBinary)
        .map(d => d[name]),
      featureValuesForNonProtectedGroup = dataset
        .filter(d => d[sensitiveAttrName] === nonProtectedGroupBinary)
        .map(d => d[name]),
      protectedGroupLength = featureValuesForProtectedGroup.length,
      nonProtectedGroupLength = featureValuesForNonProtectedGroup.length;

    const featureValuesCountObject = _.countBy(featureValues),
      featureValuesForProtectedGroupCountObject = _.countBy(
        featureValuesForProtectedGroup
      ),
      featureValuesForNonProtectedGroupCountObject = _.countBy(
        featureValuesForNonProtectedGroup
      ),
      featureValuesCount = Object.keys(featureValuesCountObject).map(
        (value, idx) => {
          return {
            value: value,
            label: label[idx],
            count: featureValuesCountObject[value]
          };
        }
      ),
      featureValuesForProtectedGroupCount = Object.keys(
        featureValuesForProtectedGroupCountObject
      ).map((value, idx) => {
        return {
          value: value,
          label: label[idx],
          count: featureValuesForProtectedGroupCountObject[value]
        };
      }),
      featureValuesForNonProtectedGroupCount = Object.keys(
        featureValuesForNonProtectedGroupCountObject
      ).map((value, idx) => {
        return {
          value: value,
          label: label[idx],
          count: featureValuesForNonProtectedGroupCountObject[value]
        };
      });

    // Both groups share the same x and y scale
    const xScale = d3
        .scaleBand()
        .domain(range)
        .range([5, _self.layout.featureTable.corr.width - 5]),
      // xScale = d3.scaleBand()
      //         .domain(range)
      //         .range([5, _self.layout.featureTable.corr.width/2 - 5]),
      yGroupScale1 = d3
        .scaleLinear()
        .domain([0, d3.max(featureValuesForProtectedGroupCount, d => d.count)])
        .range([
          _self.layout.featureTable.corr.height,
          _self.layout.featureTable.corr.height / 2 +
            _self.layout.featureTable.corr.marginBtn
        ]),
      yGroupScale2 = d3
        .scaleLinear()
        .domain([
          0,
          d3.max(featureValuesForNonProtectedGroupCount, d => d.count)
        ])
        .range([
          _self.layout.featureTable.corr.height / 2,
          _self.layout.featureTable.corr.marginBtn
        ]);
    // xAxis = d3.select(svg)
    //     .append('g')
    //     .attr('transform', 'translate(0,0)')
    //     .call(d3.axisBottom(xScale).tickSize(0).tickFormat(''));

    let protectedGroupHistogramBar, nonProtectedGroupHistogramBar;

    nonProtectedGroupHistogramBar = d3
      .select(svgCorrPlot)
      .selectAll('.g_corr_plot_group1')
      .data(featureValuesForNonProtectedGroupCount)
      .enter()
      .append('g')
      .attr('class', 'g_corr_plot_group1')
      .append('rect')
      .attr('x', d => xScale(d.value))
      .attr('y', d => yGroupScale2(d.count))
      .attr('width', xScale.bandwidth() - 0.5)
      .attr(
        'height',
        (d, i) =>
          _self.layout.featureTable.corr.height / 2 - yGroupScale2(d.count)
      )
      .style('fill', gs.groupColor1)
      .style('stroke', 'none')
      .style('opacity', 1)
      .style('shape-rendering', 'crispEdge')
      .style('stroke-width', 0.5)
      .on('mouseover', (d, i) => {
        tooltip.html(
          '<div>Group: Men</div>' +
            '<div>Label: ' +
            d.label +
            '</div>' +
            '<div>Prob: ' +
            Math.round((d.count / nonProtectedGroupLength) * 100) / 100 +
            '</div>'
        );
        tooltip.show();
      })
      .on('mouseout', (d, i) => {
        tooltip.hide();
      });

    protectedGroupHistogramBar = d3
      .select(svgCorrPlot)
      .selectAll('.g_corr_plot_group2')
      .data(featureValuesForProtectedGroupCount)
      .enter()
      .append('g')
      .attr('class', 'g_corr_plot_group2')
      .append('rect')
      .attr('x', d => xScale(d.value))
      .attr('y', d => yGroupScale1(d.count))
      .attr('width', xScale.bandwidth() - 0.5)
      .attr(
        'height',
        (d, i) => _self.layout.featureTable.corr.height - yGroupScale1(d.count)
      )
      .style('fill', gs.groupColor2)
      .style('stroke', 'none')
      .style('opacity', 1)
      .style('shape-rendering', 'crispEdge')
      .style('stroke-width', 0.5)
      .on('mouseover', (d, i) => {
        tooltip.html(
          '<div>Group: Women</div>' +
            '<div>Label: ' +
            d.label +
            '</div>' +
            '<div>Prob: ' +
            Math.round((d.count / protectedGroupLength) * 100) / 100 +
            '</div>'
        );
        tooltip.show();
      })
      .on('mouseout', (d, i) => {
        tooltip.hide();
      });

    return (
      <div className={styles.corrPlotWrapper}>{svgCorrPlot.toReact()}</div>
    );
  }

  renderCorrPlotWithSensitiveAttrForCategoricalVars(feature) {
    const _self = this;

    const { dataset, rankingInstance } = this.props,
      { instances, sensitiveAttr } = rankingInstance,
      { name, type, range } = feature,
      { protectedGroup, nonProtectedGroup } = sensitiveAttr,
      sensitiveAttrName = sensitiveAttr.name,
      sensitiveAttrRange = sensitiveAttr.range,
      label = ['No', 'Yes'];

    let protectedGroupBinary, nonProtectedGroupBinary;

    if (sensitiveAttrRange[0] === protectedGroup) {
      // Find the corresponding 0 or 1 to protected or non-protected group string
      protectedGroupBinary = 0;
      nonProtectedGroupBinary = 1;
    } else {
      protectedGroupBinary = 1;
      nonProtectedGroupBinary = 0;
    }

    const instancesForFeatureValues1 = dataset.filter(d => d[name] === 0),
      instancesForFeatureValues2 = dataset.filter(d => d[name] === 1),
      featureValuesForProtectedGroup = dataset
        .filter(d => d[sensitiveAttrName] === protectedGroupBinary)
        .map(d => d[name]),
      featureValuesForNonProtectedGroup = dataset
        .filter(d => d[sensitiveAttrName] === nonProtectedGroupBinary)
        .map(d => d[name]),
      protectedGroupLength = featureValuesForProtectedGroup.length,
      nonProtectedGroupLength = featureValuesForNonProtectedGroup.length;
    const thresholds = [0, 1];

    const dataBinProtectedGroup = d3
        .histogram()
        .domain([0, 1])
        .thresholds(thresholds)(featureValuesForProtectedGroup),
      dataBinNonProtectedGroup = d3
        .histogram()
        .domain([0, 1])
        .thresholds(thresholds)(featureValuesForNonProtectedGroup);

    const svgCorrPlot = new ReactFauxDOM.Element('svg');

    svgCorrPlot.setAttribute('width', _self.layout.featureTable.corr.width);
    svgCorrPlot.setAttribute('height', _self.layout.featureTable.corr.height);
    svgCorrPlot.setAttribute('0 0 100 100');
    svgCorrPlot.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgCorrPlot.setAttribute('class', 'svg_corr_plot_' + name);

    // Both groups share the same x and y scale
    const xScale = d3
        .scaleBand()
        .domain(dataBinProtectedGroup.map(d => d.x0))
        .range([15, _self.layout.featureTable.corr.width - 15]),
      // xScale = d3.scaleBand()
      //         .domain(dataBinNonProtectedGroup.map((d) => d.x0))
      //         .range([_self.layout.featureTable.corr.width/2 + 5, _self.layout.featureTable.corr.width - 5]),
      yGroupScale1 = d3
        .scaleLinear()
        .domain([0, 1])
        .range([
          _self.layout.featureTable.corr.height / 2,
          _self.layout.featureTable.corr.marginBtn
        ]),
      yGroupScale2 = d3
        .scaleLinear()
        .domain([0, 1])
        .range([
          _self.layout.featureTable.corr.height / 2,
          _self.layout.featureTable.corr.marginBtn
        ]),
      xGroupAxis1 = d3
        .select(svgCorrPlot)
        .append('g')
        .attr(
          'transform',
          'translate(0,' + _self.layout.featureTable.corr.height / 2 + ')'
        )
        .call(
          d3
            .axisBottom(xScale)
            .tickSize(0)
            .tickFormat('')
        ),
      xGroupAxis2 = d3
        .select(svgCorrPlot)
        .append('g')
        .attr(
          'transform',
          'translate(0,' + _self.layout.featureTable.corr.height + '0)'
        )
        .call(
          d3
            .axisBottom(xScale)
            .tickSize(0)
            .tickFormat('')
        );

    let protectedGroupHistogramBar, nonProtectedGroupHistogramBar;

    protectedGroupHistogramBar = d3
      .select(svgCorrPlot)
      .selectAll('.g_corr_plot_group2')
      .data(dataBinProtectedGroup)
      .enter()
      .append('g')
      .attr('class', 'g_corr_plot_group2')
      .attr('transform', function(d, i) {
        return (
          'translate(' +
          xScale(d.x0) +
          ',' +
          yGroupScale1(d.length / protectedGroupLength) +
          ')'
        );
      });

    protectedGroupHistogramBar
      .append('rect')
      .attr('x', 0)
      .attr('width', xScale.bandwidth() - 0.5)
      .attr('height', (d, i) => {
        return (
          _self.layout.featureTable.corr.height / 2 -
          yGroupScale1(d.length / protectedGroupLength)
        );
      })
      .style('fill', gs.groupColor2)
      .style('stroke', 'none')
      .style('opacity', 1)
      .style('shape-rendering', 'crispEdge')
      .style('stroke-width', 0.5)
      .on('mouseover', (d, i) => {
        tooltip.html(
          '<div>Group: Women</div>' +
            '<div>Label: ' +
            label[i] +
            '</div>' +
            '<div>Prob: ' +
            Math.round((d.length / protectedGroupLength) * 100) / 100 +
            '</div>'
        );
        tooltip.show();
      })
      .on('mouseout', (d, i) => {
        tooltip.hide();
      });

    nonProtectedGroupHistogramBar = d3
      .select(svgCorrPlot)
      .selectAll('.g_corr_plot_group1')
      .data(dataBinNonProtectedGroup)
      .enter()
      .append('g')
      .attr('class', 'g_corr_plot_group1')
      .attr('transform', function(d, i) {
        const groupLength =
          i == 0 ? protectedGroupLength : nonProtectedGroupLength;
        return (
          'translate(' +
          xScale(d.x0) +
          ',' +
          (_self.layout.featureTable.corr.height / 2 +
            yGroupScale2(d.length / nonProtectedGroupLength)) +
          ')'
        );
      });

    nonProtectedGroupHistogramBar
      .append('rect')
      .attr('x', 0)
      .attr('width', xScale.bandwidth() - 0.5)
      .attr('height', (d, i) => {
        const groupLength =
          i == 0 ? protectedGroupLength : nonProtectedGroupLength;
        return (
          _self.layout.featureTable.corr.height / 2 -
          yGroupScale2(d.length / nonProtectedGroupLength)
        );
      })
      .style('fill', gs.groupColor1)
      .style('stroke', 'none')
      .style('opacity', 1)
      .style('shape-rendering', 'crispEdge')
      .style('stroke-width', 0.5)
      .on('mouseover', (d, i) => {
        tooltip.html(
          '<div>Group: Men</div>' +
            '<div>Label: ' +
            label[i] +
            '</div>' +
            '<div>Count: ' +
            Math.round((d.length / nonProtectedGroupLength) * 100) / 100 +
            '</div>'
        );
        tooltip.show();
      })
      .on('mouseout', (d, i) => {
        tooltip.hide();
      });

    return (
      <div className={styles.corrPlotWrapper}>{svgCorrPlot.toReact()}</div>
    );
  }

  renderMethods() {
    const { methods } = this.props;

    return methods.map((method, idx) => (
      <DropdownItem
        key={idx}
        value={method.name}
        onClick={this.handleClickMethod}
      >
        {method.name}
      </DropdownItem>
    ));
  }

  renderFairnessQuestion1() {
    return (
      <div className={styles.fairnessQuestion1}>
        <Radio.Group
          //className={styles.protectedGroupRadioButton}
          //onChange={this.handleClickProtectedGroup}
          defaultValue={'With fairness'}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value={'Fairness'}>{'Fairness(F)'}</Radio.Button>
          <Radio.Button value={'Utility'}>{'Utility(A)'}</Radio.Button>
        </Radio.Group>
      </div>
    );
  }

  renderFairnessQuestion2() {
    return (
      <div className={styles.fairnessQuestion2}>
        <Radio.Group
          //className={styles.protectedGroupRadioButton}
          //onChange={this.handleClickProtectedGroup}
          defaultValue={'Group fairness'}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value={'Group fairness'}>
            {'Group fairness'}
          </Radio.Button>
          <Radio.Button value={'Individual fairness'}>
            {'Individual fairness'}
          </Radio.Button>
          <Radio.Button value={'Both'}>{'Both'}</Radio.Button>
        </Radio.Group>
      </div>
    );
  }

  renderFairnessQuestion3() {
    return (
      <div className={styles.fairnessQuestion3}>
        <Radio.Group
          //className={styles.protectedGroupRadioButton}
          //onChange={this.handleClickProtectedGroup}
          defaultValue={'Yes'}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value={'Yes'}>{'Yes'}</Radio.Button>
          <Radio.Button value={'No'}>{'No'}</Radio.Button>
        </Radio.Group>
      </div>
    );
  }

  renderFairnessQuestion4() {
    return (
      <div className={styles.fairnessQuestion4}>
        <Radio.Group
          //className={styles.protectedGroupRadioButton}
          //onChange={this.handleClickProtectedGroup}
          defaultValue={'Yes'}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value={'Yes'}>{'Yes'}</Radio.Button>
          <Radio.Button value={'No'}>{'No'}</Radio.Button>
        </Radio.Group>
      </div>
    );
  }

  render() {
    const _self = this;

    console.log('Generater rendered');
    const { dataset, rankingInstance, methods } = this.props,
      { features, sensitiveAttr, target, method } = rankingInstance,
      wholeFeatures = Object.keys(dataset[0]).filter(d => d !== 'idx');

    // For feature selection
    const featureNames = features.map(feature => feature.name),
      selectedRowKeys = wholeFeatures
        .map((d, idx) => {
          const isFeatureSelected = featureNames.filter(e => d === e);
          if (isFeatureSelected.length !== 0) return idx + 1;
          return 'notSelected';
        })
        .filter(f => f !== 'notSelected'),
      targetName = target.name,
      sensitiveAttrName = sensitiveAttr.name,
      methodName = method.name;

    const featureSelectionColumns = [
      { title: 'Feature', dataIndex: 'feature', key: 1, width: 100 },
      { title: 'Corr', dataIndex: 'corr', key: 2 },
      { title: 'Distribution', dataIndex: 'distribution', key: 3 }
    ];
    const dataFeatureTable = this.renderFeatureSelectionsForTable();
    const featureSelection = {
      selectedRowKeys,
      onChange: (selectedRowKeys, selectedRows) => {
        const selectedFeatureNames = selectedRows.map(d =>
          d.feature.split(' ').join('_')
        );
        return _self.handleSelectFeatures(selectedFeatureNames);
      },
      getCheckboxProps: record => {
        const isSelected = featureNames.filter(d => d !== record.feature);
        return {
          disabled: isSelected.length === 0
        };
      }
    };

    // For method selection
    const methodSelectionColumns = [
      { title: 'Method', dataIndex: 'method', key: 1, width: 80 },
      { title: 'Q1', dataIndex: 'Q1', key: 2 },
      { title: 'Q2', dataIndex: 'Q2', key: 3 },
      { title: 'Q3', dataIndex: 'Q3', key: 4 },
      { title: 'Q4', dataIndex: 'Q4', key: 5 }
    ];
    const dataMethodTable = this.renderMethodSelectionsForTable();
    const methodSelectionRows = {
      onChange: (selectedRowKeys, selectedRows) => {},
      getCheckboxProps: record => ({
        disabled: record.name === 'Disabled User',
        name: record.name
      })
    };

    const antIcon = <Icon type="loading" style={{ fontSize: 17 }} spin />;

    return (
      <div className={styles.Generator}>
        <div className={styles.generatorTitleWrapper}>
          <span className={styles.generatorTitle + ' ' + index.title}>
            Generator
          </span>
          <br />
        </div>
        {/* // Dataset selector */}
        {/* <div className={styles.generatorDatasetWrapper}>
          <div className={styles.generatorSubTitle}>Dataset</div>
          <div className={styles.generatorDescription}>
            <div>- 12 Features</div>
            <div>- 100 instances</div>
          </div>
        </div> */}
        {/* <div className={styles.generatorSubTitle}>Feature</div> */}
        {/* // Sensitive Attribute selector */}
        <div className={styles.selectSensitiveAttr}>Sensitive attribute</div>
        <Dropdown
          className={styles.sensitiveAttrDropdown}
          isOpen={this.state.sensitiveAttrDropdownOpen}
          toggle={this.toggleSensitiveAttrDropdown}
        >
          <DropdownToggle className={styles.sensitiveAttrDropdownToggle} caret>
            {sensitiveAttrName}
          </DropdownToggle>
          <DropdownMenu>{this.renderSensitiveAttrSelections()}</DropdownMenu>
        </Dropdown>
        {/* // Protected Group selector */}
        {typeof this.props.rankingInstance.sensitiveAttr === 'undefined' ? (
          <div />
        ) : (
          this.renderSelectProtectedGroup()
        )}
        {/* // Feature selector */}
        <div className={styles.selectFeatures}>
          Features
          <br />
          {/* <Button 
            id='buttonUnawareness'
            type="primary" 
            size="small">
            Fairness through Unawareness
          </Button> */}
        </div>
        <TreeSelect
          className={styles.featureSelector}
          showSearch
          style={{ width: 330 }}
          value={featureNames}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          placeholder="Please select"
          allowClear
          multiple
          treeDefaultExpandAll
          onChange={this.handleSelectFeatures}
        >
          {this.renderFeatureSelections()}
        </TreeSelect>
        <Table
          rowSelection={featureSelection}
          columns={featureSelectionColumns}
          dataSource={dataFeatureTable}
          scroll={{ y: 250 }}
          pagination={false}
        />
        {/* // Target variable selector */}
        <div className={styles.selectSensitiveAttr}>Target variable</div>
        <Dropdown
          className={styles.targetDropdown}
          isOpen={this.state.targetDropdownOpen}
          toggle={this.toggleTargetDropdown}
        >
          <DropdownToggle className={styles.targetDropdownToggle} caret>
            {targetName}
          </DropdownToggle>
          <DropdownMenu>{this.renderTargetSelections()}</DropdownMenu>
        </Dropdown>
        {/* // Method selector */}
        <div className={styles.generatorSubTitle}>Method</div>
        {/* // Protected Group selector */}
        <div className={styles.generatorSubSubTitle}>Utility-oriented</div>
        <Button
          id={'buttonMethodRankSVM'}
          value={'RankSVM'}
          type="primary"
          size="small"
          onClick={this.handleMethodSelected}
        >
          RankSVM
        </Button>
        <Button
          id={'buttonMethodLogisticRegression'}
          value={'Logistic Regression'}
          type="primary"
          size="small"
          onClick={this.handleMethodSelected}
        >
          Logistic Regression
        </Button>
        <Button
          id={'buttonMethodSVM'}
          value={'SVM'}
          type="primary"
          size="small"
          onClick={this.handleMethodSelected}
        >
          SVM
        </Button>
        <div className={styles.generatorSubSubTitle}>
          Fairness-oriented (In-processing)
        </div>
        <Button
          id={'buttonMethodAdditiveCounterfactualFairness'}
          value={'Additive Counterfactual Fairness'}
          type="primary"
          size="small"
          onClick={this.handleMethodSelected}
        >
          Additive Counterfactual Fairness
        </Button>
        <div className={styles.generatorSubSubTitle}>Post-processing</div>
        <Button
          id={'buttonReranking'}
          value={'Reranking'}
          type="primary"
          size="small"
          onClick={this.handleMethodSelected}
        >
          Reranking
        </Button>
        <Dropdown
          className={styles.methodDropdown}
          isOpen={this.state.methodDropdownOpen}
          toggle={this.toggleMethodDropdown}
        >
          <DropdownToggle className={styles.methodDropdownToggle} caret>
            {methodName}
          </DropdownToggle>
          <DropdownMenu>{this.renderMethods()}</DropdownMenu>
        </Dropdown>
        {/* <Table 
          rowSelection={methodSelectionRows}
          columns={methodSelectionColumns} 
          dataSource={dataMethodTable} 
          scroll={{ y: 150 }}
          pagination={false}
        /> */}
        <div
          className={styles.runButtonWrapper}
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          {this.props.isModelRunning ? <Spin indicator={antIcon} /> : <span />}
          &nbsp;&nbsp;
          <Button
            className={styles.buttonGenerateRanking}
            color="danger"
            onClick={this.handleClickRun}
          >
            RUN
          </Button>
        </div>
      </div>
    );
  }
}

export default Generator;
