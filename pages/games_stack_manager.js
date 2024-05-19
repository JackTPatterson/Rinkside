import {NavigationContainer} from "@react-navigation/native";
import {createStackNavigator} from "@react-navigation/stack";
import {Appearance} from "react-native";
import GamesDetail from "./game_detail";
import Games from "./games";
import Recap from "./recap";

export default function GamesStackManager() {
    const Stack = createStackNavigator();

    const scheme = Appearance.getColorScheme();


    const DarkTheme = {
        dark: true,
        colors: {
            primary: 'rgb(10, 132, 255)',
            background: 'rgb(1, 1, 1)',
            card: 'rgb(18, 18, 18)',
            text: 'rgb(229, 229, 231)',
            border: 'rgb(39, 39, 41)',
            notification: 'rgb(255, 69, 58)'

        }
    };

    const LightTheme = {
        dark: false,
        colors: {
            primary: 'rgb(0, 122, 255)',
            background: 'white',
            card: '#f7f7f7',
            text: 'rgb(28, 28, 30)',
            border: 'rgb(216, 216, 216)',
            notification: 'rgb(255, 59, 48)'
        }
    };

    return (

        <NavigationContainer theme={scheme === 'dark' ? DarkTheme : LightTheme} independent={true}>

            <Stack.Navigator
                lazy={true}
                optimizationsEnabled={true}
                screenOptions={{
                    headerShown: false,
                    useNativeDriver: false
                }}
                initialRouteName="Games">
                <Stack.Screen name="Games" component={Games}/>
                <Stack.Screen name="Games_Detail" component={GamesDetail}/>
                <Stack.Screen name="Game_Recap" component={Recap}/>


            </Stack.Navigator>


        </NavigationContainer>
    )

}
