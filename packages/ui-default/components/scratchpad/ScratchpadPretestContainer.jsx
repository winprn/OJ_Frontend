import React from 'react';
import { connect } from 'react-redux';
import AnsiUp from 'ansi_up';

import i18n from 'vj/utils/i18n';
import Icon from 'vj/components/react/IconComponent';
import Panel from './PanelComponent';
import DataInput from './DataInputComponent';

const AU = new AnsiUp();

const mapStateToProps = (state) => ({
  input: state.pretest.input,
  output: state.pretest.output,
  rid: state.pretest.rid,
});

const mapDispatchToProps = (dispatch) => ({
  handleDataChange(type, value) {
    dispatch({
      type: 'SCRATCHPAD_PRETEST_DATA_CHANGE',
      payload: {
        type,
        value,
      },
    });
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(class ScratchpadPretestContainer extends React.PureComponent {
  render() {
    return (
      <Panel
        title={(
          <span>
            <Icon name="edit" />
            {' '}
            {i18n('Pretest')}
          </span>
        )}
      >
        <div className="flex-row flex-fill">
          <DataInput
            title={i18n('Input')}
            value={this.props.input}
            onChange={(v) => this.props.handleDataChange('input', v)}
          />
          <DataInput
            title={i18n('Output')}
            value={AU.ansi_to_html(this.props.output)}
            html
          />
        </div>
      </Panel>
    );
  }
});
