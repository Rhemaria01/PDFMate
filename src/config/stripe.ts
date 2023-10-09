export const PLANS = [
    {
        name: 'Free',
        slug: 'free',
        quota: 10,
        pagePerPdf: 5,
        price: {
            amount: 0,
            priceIds: {
                test: '',
                production: ''
            }
        }
    },{
        name: 'Pro',
        slug: 'pro',
        quota: 50,
        pagePerPdf: 25,
        price: {
            amount: 9.99,
            priceIds: {
                test: 'price_1NzKGISHni2VRAceT7SdIW7n',
                production: 'price_1NxsCzSHni2VRAceTuIrNyD0'
            }
        }
    }
]