import {NavigationContainer} from "@react-navigation/native";
import {createStackNavigator} from "@react-navigation/stack";
import GamesDetail from "./game_detail";
import Games from "./games";

export default function GamesStackManager(){
    const Stack = createStackNavigator();

    return (

        <NavigationContainer independent={true}>

            <Stack.Navigator
                lazy={true}
                optimizationsEnabled={true}
                screenOptions={{
                    headerShown: false,
                    useNativeDriver: false,
                }}
                initialRouteName="Games">
                <Stack.Screen name="Games" component={Games}/>
                <Stack.Screen name="Games_Detail" component={GamesDetail}/>



            </Stack.Navigator>


        </NavigationContainer>
    )

}
