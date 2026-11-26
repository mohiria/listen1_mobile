import React from 'react';
import styled from 'styled-components';

const Box = styled.View`
  padding: 30px 20px;
  align-items: center;
`;
const Message = styled.Text`
  color: ${props => props.theme.secondaryColor};
  font-size: 14px;
`;
const RetryButton = styled.TouchableOpacity`
  margin-top: 15px;
  padding: 8px 24px;
  border-width: 1px;
  border-color: ${props => props.theme.primaryColor};
  border-radius: 4px;
`;
const RetryText = styled.Text`
  color: ${props => props.theme.primaryColor};
  font-size: 14px;
`;

// What a list shows in place of its rows: a failure the user can retry
// (pass onRetry), or a plain note that there is nothing to show.
export function ListStatus({ message, onRetry }) {
  return (
    <Box>
      <Message>{message}</Message>
      {onRetry ? (
        <RetryButton onPress={onRetry}>
          <RetryText>重试</RetryText>
        </RetryButton>
      ) : null}
    </Box>
  );
}
