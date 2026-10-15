import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useAppTheme} from '../theme';
import {T, tap} from './ui';

function Fallback({onRetry}) {
    const {colors} = useAppTheme();
    return (
        <View style={[styles.wrap, {backgroundColor: colors.background}]}>
            <T variant="heading" style={{textAlign: 'center'}}>Something went wrong</T>
            <T variant="body" muted style={{textAlign: 'center'}}>
                This screen hit an unexpected problem. The rest of the app still works.
            </T>
            <Pressable
                accessibilityRole="button"
                onPress={() => {
                    tap();
                    onRetry();
                }}
                style={[styles.button, {backgroundColor: colors.text}]}>
                <T variant="label" color={colors.background}>Try again</T>
            </Pressable>
        </View>
    );
}

/** Per-screen error boundary: a crash in one screen never takes down the tab bar or other tabs. */
export default class ErrorBoundary extends React.Component {
    state = {error: null};

    static getDerivedStateFromError(error) {
        return {error};
    }

    componentDidCatch(error, info) {
        if (__DEV__) console.error('Screen crashed:', error, info?.componentStack);
    }

    render() {
        if (this.state.error) return <Fallback onRetry={() => this.setState({error: null})}/>;
        return this.props.children;
    }
}

const styles = StyleSheet.create({
    wrap: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12},
    button: {marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999},
});
