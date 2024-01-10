import React from "react";
import {SafeAreaView, StyleSheet, Text, View} from "react-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";


export default function Team() {

    const styles = StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingHorizontal: 10,
            height: '100%',
            backgroundColor: 'white'
        }
    });

    return (
        <GestureHandlerRootView>
            <View style={styles.container}>
                <SafeAreaView style={{width: '100%'}}>
                    <Text style={{fontFamily: 'Sora_500Medium', marginBottom: 20, fontSize: 24}}>New York Islanders</Text>
                </SafeAreaView>
            </View>
        </GestureHandlerRootView>
    );


}
