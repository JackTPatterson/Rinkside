import React, {Component} from "react";
import {Animated, Easing, StyleSheet, Text, View} from "react-native";
import PropTypes from "prop-types";

const NumberTicker = ({style, textSize = 35, textStyle, number, duration}) => {

    const mapToDigits = () => {
        return (number + '').split('').map((data, index) => {
            if (data === '.') {
                return (
                    <DotTicker
                        key={index}
                        textSize={textSize}
                        textStyle={textStyle}
                        duration={duration}
                    />
                );
            }
            else if (data === '$') {
                return (
                    <DollarTicker
                        key={index}
                        textSize={textSize}
                        textStyle={textStyle}
                        duration={duration}
                    />
                );
            }
            return (
                <TextTicker
                    key={index}
                    textSize={textSize}
                    textStyle={textStyle}
                    targetNumber={parseFloat(data, 10)}
                    duration={duration}
                />
            );
        })
    };

    return (
        <View style={style}>
            <View style={{flexDirection: 'row'}}>
                {mapToDigits()}
            </View>
        </View>
    );
};

class TextTicker extends Component {

    constructor(props) {
        super(props);
        this.state = {
            animatedValue: new Animated.Value(0),
            opacityValue: new Animated.Value(0),
            isAnimating: true,
            delay: 800,
            number: 1
        };
        const {targetNumber} = this.props;

        this.numberList.push({id: targetNumber});

    }

    componentDidMount() {
        this.startAnimation();
    }

    numberList = [];

    startAnimation = () => {
        const {animatedValue} = this.state;
        const {opacityValue} = this.state;
        Animated.timing(animatedValue, {
            toValue: 1,
            duration: this.props.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        Animated.timing(opacityValue, {
            toValue: 1,
            duration: this.props.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    };

    getInterpolatedVal = (val) => {
        return val.interpolate({
            inputRange: [0, 1],
            outputRange: [this.props.textSize * this.numberList.length, this.props.textSize*0.2],
            extrapolate: 'clamp',
        });
    };


    renderNumbers = (styles) => {
        return this.numberList.map((data, index) => {
            return (
                <Text style={[this.props.textStyle, styles.text]}>{data.id}</Text>
            )
        });
    };

    render() {
        const {animatedValue} = this.state;
        const {opacityValue} = this.state;
        const styles = generateStyles(this.props.textSize);

        return (
            <View style={styles.container}>
                <Animated.View style={{
                    transform: [{
                        translateY: this.getInterpolatedVal(animatedValue)
                    }],
                    opacity: opacityValue
                }}>
                    {this.renderNumbers(styles)}
                </Animated.View>
            </View>
        );
    }
}

class DotTicker extends Component {

    constructor(props) {
        super(props);
        this.state = {
            animatedValue: new Animated.Value(0),
            opacityValue: new Animated.Value(0),
            isAnimating: true,
            delay: 800,
            number: 1
        };



        this.numberList.push({id: "."});

    }

    componentDidMount() {
        this.startAnimation();
    }

    numberList = [];

    startAnimation = () => {
        const {animatedValue} = this.state;
        const {opacityValue} = this.state;
        Animated.timing(animatedValue, {
            toValue: 1,
            duration: this.props.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        Animated.timing(opacityValue, {
            toValue: 1,
            duration: this.props.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

    };

    getInterpolatedVal = (val) => {
        return val.interpolate({
            inputRange: [0, 1],
            outputRange: [this.props.textSize * this.numberList.length, this.props.textSize*0.2],
            extrapolate: 'clamp',
        });
    };



    renderNumbers = (styles) => {
        return this.numberList.map((data, index) => {
            return (
                <Text style={[this.props.textStyle, styles.text]}>{data.id}</Text>
            )
        });
    };

    render() {
        const {animatedValue} = this.state;
        const {opacityValue} = this.state;
        const styles = generateStyles(this.props.textSize);

        return (
            <View style={styles.dotContainer}>
                <Animated.View style={{
                    transform: [{
                        translateY: this.getInterpolatedVal(animatedValue)
                    }],
                    opacity: opacityValue
                }}>
                    {this.renderNumbers(styles)}
                </Animated.View>
            </View>
        );
    }
}

class DollarTicker extends Component {

    constructor(props) {
        super(props);
        this.state = {
            animatedValue: new Animated.Value(0),
            opacityValue: new Animated.Value(0),
            isAnimating: true,
            delay: 800,
            number: 1
        };



        this.numberList.push({id: "$"});

    }

    componentDidMount() {
        this.startAnimation();
    }

    numberList = [];

    startAnimation = () => {
        const {animatedValue} = this.state;
        const {opacityValue} = this.state;
        Animated.timing(animatedValue, {
            toValue: 1,
            duration: this.props.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        Animated.timing(opacityValue, {
            toValue: 1,
            duration: this.props.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

    };

    getInterpolatedVal = (val) => {
        return val.interpolate({
            inputRange: [0, 1],
            outputRange: [this.props.textSize * this.numberList.length, this.props.textSize*0.2],
            extrapolate: 'clamp',
        });
    };



    renderNumbers = (styles) => {
        return this.numberList.map((data) => {
            return (
                <Text style={[this.props.textStyle, styles.text]}>{data.id}</Text>
            )
        });
    };

    render() {
        const {animatedValue} = this.state;
        const {opacityValue} = this.state;
        const styles = generateStyles(this.props.textSize);

        return (
            <View style={styles.container}>
                <Animated.View style={{
                    transform: [{
                        translateY: this.getInterpolatedVal(animatedValue)
                    }],
                    opacity: opacityValue
                }}>
                    {this.renderNumbers(styles)}
                </Animated.View>
            </View>
        );
    }
}

TextTicker.defaultProps = {
    duration: 1800,
    targetNumber: 7,
    movingDown: true,
    textSize: 35,
};

TextTicker.propTypes = {
    duration: PropTypes.number,
    targetNumber: PropTypes.number,
    movingDown: PropTypes.bool,
    textSize: PropTypes.number,
    textStyle: PropTypes.any,
};

const generateStyles = (textSize) => StyleSheet.create({
    container: {
        width: textSize * 0.7,
        height: textSize,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    dotContainer: {
        width: textSize * 0.4,
        height: textSize,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    text: {
        fontSize: textSize,
        lineHeight: textSize * 1.05,
    },
});

export default NumberTicker;
